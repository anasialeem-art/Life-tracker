import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { commitRows, runSync } from './bankSync'
import { db } from './db'
import { decodeText, parseAmount, parseDate, parseStatementFile, payeeFromText, splitCsv, ImportError } from './statementImport'

const enc = (s: string) => new TextEncoder().encode(s)

// Layout of the CSV export from Commerzbank online banking ("Umsätze → Export → CSV").
const COMMERZBANK_CSV = [
  'Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung;Auftraggeberkonto;Bankleitzahl Auftraggeberkonto;IBAN Auftraggeberkonto;Kategorie',
  '22.10.2026;22.10.2026;Lastschrift;"REWE SAGT DANKE 4711//BERLIN/DE 2026-10-21T18:02:11 Karte Nr. 4871 Kartenzahlung";-23,45;EUR;;;DE12500105170648489890;Lebensmittel',
  '21.10.2026;21.10.2026;Lastschrift;NETFLIX.COM End-to-End-Ref.: 123 Mandatsref: M1;-13,99;EUR;;;;Unterhaltung',
  '20.10.2026;20.10.2026;Gutschrift;ACME GmbH LOHN GEHALT 10/2026;2.500,00;EUR;;;DE02120300000000202051;Gehalt',
  '20.10.2026;20.10.2026;Lastschrift;Backstube Krause;-3,50;EUR;;;;',
  '20.10.2026;20.10.2026;Lastschrift;Backstube Krause;-3,50;EUR;;;;',
].join('\r\n')

describe('statement file parsing', () => {
  it('reads the Commerzbank CSV export', async () => {
    const p = await parseStatementFile(enc(COMMERZBANK_CSV))
    expect(p.format).toBe('csv')
    expect(p.rows.map((r) => [r.day, r.amount, r.payee])).toEqual([
      ['2026-10-22', -2345, 'REWE SAGT DANKE 4711'], ['2026-10-21', -1399, 'NETFLIX.COM'], ['2026-10-20', 250000, 'ACME GmbH LOHN GEHALT 10/2026'],
      ['2026-10-20', -350, 'Backstube Krause'], ['2026-10-20', -350, 'Backstube Krause'],
    ])
    expect(p.rows[0].payeeIban).toBe('DE12500105170648489890')
    expect(p.rows[0].purpose).toContain('Kartenzahlung')
  })

  it('reads other bank layouts: separate payee column, Soll/Haben, commas, Windows-1252', async () => {
    const sparkasse = 'Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer/IBAN;Betrag;Waehrung\n' +
      '"DE00";"02.10.26";"02.10.26";"KARTENZAHLUNG";"Einkauf; Filiale 12";"Bäckerei Müller";"DE99";"-4,20";"EUR"'
    const a = await parseStatementFile(enc(sparkasse))
    expect(a.rows).toEqual([{ day: '2026-10-02', amount: -420, payee: 'Bäckerei Müller', payeeIban: 'DE99', purpose: 'Einkauf; Filiale 12' }])

    const sollHaben = 'Konto: DE00\nKontostand: 100\n\nDatum,Empfänger,Verwendungszweck,Soll,Haben\n2026-10-03,Shop,Order 1,"1,234.50",\n2026-10-04,Boss,Pay,,"2,000.00"\nEndsaldo,,,,'
    const b = await parseStatementFile(enc(sollHaben))
    expect(b.rows.map((r) => r.amount)).toEqual([-123450, 200000])
    expect(b.skipped).toBe(1)

    const latin1 = new Uint8Array([...enc('Buchungstag;Betrag;Empf'), 0xe4, ...enc('nger\n01.10.2026;-1,00;M'), 0xfc, ...enc('ller')])
    expect((await parseStatementFile(latin1)).rows[0].payee).toBe('Müller')
  })

  it('reads MT940 files', async () => {
    const mt = [':20:STARTUMSE', ':25:37040044/0532013000', ':28C:00000/001', ':60F:C261001EUR1000,00',
      ':61:2610021002DR12,34N005NONREF', ':86:106?00KARTENZAHLUNG?20REWE SAGT DANKE?32REWE Markt GmbH', ':62F:C261002EUR987,66', '-'].join('\n')
    const p = await parseStatementFile(enc(mt))
    expect(p.format).toBe('mt940')
    expect(p.rows).toEqual([{ day: '2026-10-02', amount: -1234, payee: 'REWE Markt GmbH', payeeIban: '', purpose: 'REWE SAGT DANKE' }])
    expect(p.balance).toEqual({ amount: 98766, day: '2026-10-02' })
  })

  it('explains what is wrong with unusable files', async () => {
    await expect(parseStatementFile(enc('%PDF-1.7 ...'))).rejects.toThrow(/PDF/)
    await expect(parseStatementFile(enc('name,age\nBob,3'))).rejects.toThrow(ImportError)
    await expect(parseStatementFile(enc(''))).rejects.toThrow(/empty/)
  })

  it('parses amounts, dates, quotes and payee names', () => {
    expect([parseAmount('-1.234,56'), parseAmount('1,234.56'), parseAmount('12,5 €'), parseAmount('(9.99)'), parseAmount('3-'), parseAmount('1.000'), parseAmount('x')])
      .toEqual([-123456, 123456, 1250, -999, -300, 100000, null])
    expect([parseDate('31.12.2026'), parseDate('1.2.26'), parseDate('2026-02-30'), parseDate('2026-10-05T00:00')]).toEqual(['2026-12-31', '2026-02-01', null, '2026-10-05'])
    expect(splitCsv('a;"b;""c"""\n"x\ny";z', ';')).toEqual([['a', 'b;"c"'], ['x\ny', 'z']])
    expect(payeeFromText('PayPal Europe S.a.r.l. et Cie S.C.A End-to-End-Ref.: 1')).toBe('PayPal Europe S.a.r.l. et Cie S.C.A')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe('A')
  })
})

describe('importing', () => {
  beforeEach(async () => {
    await Promise.all([db.finTx.clear(), db.finRules.clear(), db.finBalances.clear(), db.settings.clear(), db.meta.clear()])
  })

  it('adds once, keeps same-day twins, and never duplicates on re-import', async () => {
    const { rows } = await parseStatementFile(enc(COMMERZBANK_CSV))
    expect((await commitRows(rows, 'import', { dryRun: true })).added).toBe(5)
    expect(await db.finTx.count()).toBe(0)
    expect((await commitRows(rows, 'import')).added).toBe(5)
    expect((await commitRows(rows, 'import')).added).toBe(0)
    expect(await db.finTx.count()).toBe(5)
    expect((await db.finTx.toArray()).every((t) => t.source === 'import')).toBe(true)
    expect(await db.settings.get('finLastSyncAt')).toBeUndefined()
  })

  it('matches imported rows with the same bookings from the bank sync', async () => {
    const { rows } = await parseStatementFile(enc(COMMERZBANK_CSV))
    await commitRows(rows, 'import')
    // The bank describes the same bookings with different text, plus one new payment and a third coffee.
    const bank = [
      { day: '2026-10-22', amount: -2345, payee: 'REWE Markt GmbH', payeeIban: '', purpose: 'REWE SAGT DANKE' },
      { day: '2026-10-20', amount: -350, payee: 'BACKSTUBE KRAUSE', payeeIban: '', purpose: 'Kartenzahlung' },
      { day: '2026-10-20', amount: -350, payee: 'BACKSTUBE KRAUSE', payeeIban: '', purpose: 'Kartenzahlung' },
      { day: '2026-10-20', amount: -350, payee: 'BACKSTUBE KRAUSE', payeeIban: '', purpose: 'Kartenzahlung' },
      { day: '2026-10-23', amount: -999, payee: 'Spotify', payeeIban: '', purpose: '' },
    ]
    const r = await runSync({ fetch: async () => ({ transactions: bank, balance: { amount: 100000, day: '2026-10-23' }, holder: null }) })
    expect(r.added).toBe(2)
    expect(await db.finTx.count()).toBe(7)
    // Syncing the same again adds nothing.
    expect((await runSync({ fetch: async () => ({ transactions: bank, balance: null, holder: null }) })).added).toBe(0)
    // And re-importing the file after the sync adds nothing either.
    expect((await commitRows(rows, 'import')).added).toBe(0)
  })

  it('does not overwrite a balance the bank reported', async () => {
    await commitRows([], 'bank', { balance: { amount: 5000, day: '2026-10-02' } })
    await commitRows([], 'import', { balance: { amount: 1, day: '2026-10-02' } })
    await commitRows([], 'import', { balance: { amount: 7000, day: '2026-09-30' } })
    expect((await db.finBalances.toArray()).map((b) => [b.day, b.amount])).toEqual([['2026-09-30', 7000], ['2026-10-02', 5000]])
  })
})
