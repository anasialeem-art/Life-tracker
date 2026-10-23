import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BankError, runSync, syncStartDay, type BankConnector, type BankFetchResult } from './bankSync'
import { db, setMeta, type FinRule, type FinTx } from './db'
import {
  addRule, autoCategory, blzFromIban, balanceHistory, detectSubscriptions, isOwnName, limitState, payeeKey, recategorizeAll,
  setTxCategory, spendByCategory, suggestRule, txIds, type RawTx,
} from './finance'
import { createFintsConnector, mapBankError, pickTanMethod, setTransport, timing, type TanMethod, type TanUi } from './fints'

const raw = (day: string, amount: number, payee: string, purpose = '', payeeIban = ''): RawTx => ({ day, amount, payee, purpose, payeeIban })

const tx = (day: string, amount: number, payee: string, extra: Partial<FinTx> = {}): FinTx => ({
  id: `${day}-${amount}-${payee}-${Math.random()}`, day, month: day.slice(0, 7), amount, payee, payeeIban: '', purpose: '',
  category: null, categorySource: null, note: '', syncedAt: 0, ...extra,
})

const rule = (contains: string, category: FinRule['category'], field: FinRule['field'] = 'payee', order = 0): FinRule =>
  ({ id: contains, field, contains, category, order, createdAt: 0 })

describe('dedupe ids', () => {
  it('are stable and ignore whitespace differences', async () => {
    const [a] = await txIds([raw('2026-10-02', -1234, 'REWE  Markt', 'Karte')])
    const [b] = await txIds([raw('2026-10-02', -1234, ' REWE Markt ', 'Karte ')])
    expect(a).toBe(b)
  })
  it('keep two identical payments on one day apart', async () => {
    const ids = await txIds([raw('2026-10-02', -350, 'Bakery'), raw('2026-10-02', -350, 'Bakery')])
    expect(new Set(ids).size).toBe(2)
  })
  it('differ when any of date, amount, payee or purpose differ', async () => {
    const base = raw('2026-10-02', -350, 'Bakery', 'x')
    const ids = await txIds([base, { ...base, day: '2026-10-03' }, { ...base, amount: -351 }, { ...base, payee: 'Cafe' }, { ...base, purpose: 'y' }])
    expect(new Set(ids).size).toBe(5)
  })
})

describe('categorisation', () => {
  const ctx = { rules: [rule('REWE', 'groceries'), rule('GEHALT', 'income', 'purpose')], ownIbans: ['DE02 1203 0000 0000 2020 51'], holder: 'ALEEM, ANAS' }
  it('applies rules on payee or purpose', () => {
    expect(autoCategory({ payee: 'REWE Markt GmbH', purpose: '', payeeIban: '', amount: -500 }, ctx)).toEqual({ category: 'groceries', categorySource: 'rule' })
    expect(autoCategory({ payee: 'ACME', purpose: 'LOHN GEHALT 10/26', payeeIban: '', amount: 250000 }, ctx).category).toBe('income')
  })
  it('spots transfers to own accounts by IBAN or holder name', () => {
    expect(autoCategory({ payee: 'Someone', purpose: '', payeeIban: 'DE02120300000000202051', amount: -10000 }, ctx).category).toBe('transfer')
    expect(autoCategory({ payee: 'Anas Aleem', purpose: 'Sparen', payeeIban: 'DE00999', amount: -10000 }, ctx).category).toBe('transfer')
    expect(isOwnName('Anas Müller', 'ALEEM, ANAS')).toBe(false)
  })
  it('treats other money in as income and leaves unknown spending uncategorised', () => {
    expect(autoCategory({ payee: 'Friend', purpose: '', payeeIban: '', amount: 2000 }, ctx)).toEqual({ category: 'income', categorySource: 'auto' })
    expect(autoCategory({ payee: 'Kiosk', purpose: '', payeeIban: '', amount: -200 }, ctx)).toEqual({ category: null, categorySource: null })
  })
  it('lets the first rule in order win', () => {
    const c = { ...ctx, rules: [rule('REWE', 'groceries', 'payee', 5), rule('REWE TO GO', 'food', 'payee', 1)] }
    expect(autoCategory({ payee: 'REWE To Go', purpose: '', payeeIban: '', amount: -300 }, c).category).toBe('food')
  })
  it('suggests a payee rule for "apply to all similar"', () => {
    expect(suggestRule({ payee: ' Lidl  Berlin ', purpose: 'x' })).toEqual({ field: 'payee', contains: 'Lidl Berlin' })
    expect(suggestRule({ payee: '', purpose: 'Miete Oktober Wohnung 3' })).toEqual({ field: 'purpose', contains: 'Miete Oktober Wohnung' })
  })
})

describe('monthly totals and limits', () => {
  it('nets refunds and ignores income and transfers', () => {
    const s = spendByCategory([
      tx('2026-10-01', -5000, 'REWE', { category: 'groceries' }), tx('2026-10-02', 500, 'REWE', { category: 'groceries' }),
      tx('2026-10-03', 300000, 'ACME', { category: 'income' }), tx('2026-10-04', -20000, 'Me', { category: 'transfer' }),
      tx('2026-10-05', -999, 'Kiosk'),
    ])
    expect(s).toEqual({ groceries: 4500, food: 0, subscriptions: 0, gym: 0, other: 0 })
  })
  it('colours budgets near and over the limit, and paid categories when full', () => {
    expect(limitState('groceries', 100, 0)).toBe('none')
    expect(limitState('groceries', 7000, 10000)).toBe('ok')
    expect(limitState('groceries', 8500, 10000)).toBe('near')
    expect(limitState('groceries', 10001, 10000)).toBe('over')
    expect(limitState('gym', 2999, 2999)).toBe('paid')
    expect(limitState('subscriptions', 1000, 3000)).toBe('ok')
  })
  it('works month-end balances back from the latest balance, skipping months before the history starts', () => {
    const txs = [tx('2026-08-15', -1000, 'a'), tx('2026-09-10', -2000, 'b'), tx('2026-10-05', 5000, 'c')]
    const h = balanceHistory(txs, { day: '2026-10-20', amount: 100000, at: 0 }, ['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(h).toEqual([
      { month: '2026-08', amount: 97000 }, { month: '2026-09', amount: 95000 }, { month: '2026-10', amount: 100000 },
    ])
  })
})

describe('subscription detection', () => {
  const monthly = (payee: string, amount: number, days: string[]) => days.map((d) => tx(d, amount, payee))
  it('finds a monthly payment with a stable amount', () => {
    const subs = detectSubscriptions(monthly('NETFLIX.COM 866', -1399, ['2026-07-03', '2026-08-03', '2026-09-02', '2026-10-03']), '2026-10-20')
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({ payee: 'NETFLIX.COM 866', amount: 1399, interval: 'monthly', perMonth: 1399, count: 4 })
  })
  it('tolerates small price changes and splits one payee by amount', () => {
    const txs = [
      ...monthly('PayPal Europe', -999, ['2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10']),
      ...monthly('PayPal Europe', -4523, ['2026-07-02', '2026-07-19', '2026-09-30']),
      ...monthly('McFit', -2990, ['2026-07-01', '2026-08-01']), ...monthly('McFit', -3190, ['2026-09-01', '2026-10-01']),
    ]
    const subs = detectSubscriptions(txs, '2026-10-20')
    expect(subs.map((s) => [s.payee, s.amount])).toEqual([['McFit', 3190], ['PayPal Europe', 999]])
  })
  it('skips irregular, stopped and ignored ones, and never counts income', () => {
    expect(detectSubscriptions(monthly('Bakery', -350, ['2026-09-01', '2026-09-04', '2026-09-20', '2026-10-01']), '2026-10-20')).toEqual([])
    expect(detectSubscriptions(monthly('Old Gym', -2000, ['2026-03-01', '2026-04-01', '2026-05-01']), '2026-10-20')).toEqual([])
    expect(detectSubscriptions(monthly('ACME', 300000, ['2026-08-01', '2026-09-01', '2026-10-01']), '2026-10-20')).toEqual([])
    const n = monthly('Spotify', -1099, ['2026-08-05', '2026-09-05', '2026-10-05'])
    const [found] = detectSubscriptions(n, '2026-10-20')
    expect(detectSubscriptions(n, '2026-10-20', new Set([found.key]))).toEqual([])
  })
  it('finds yearly payments', () => {
    expect(detectSubscriptions(monthly('ADAC', -5400, ['2023-11-01', '2024-11-01']), '2026-10-20')).toEqual([])
    expect(detectSubscriptions(monthly('ADAC', -5400, ['2024-10-15', '2025-10-14']), '2026-01-20')[0]).toMatchObject({ interval: 'yearly', perMonth: 450 })
    expect(payeeKey('NETFLIX.COM 866-579')).toBe('netflix com')
  })
})

// ---- Sync against a fake bank ----------------------------------------------------------

const fake = (result: BankFetchResult | Error, seen: (string | null)[] = []): BankConnector => ({
  async fetch(from) {
    seen.push(from)
    if (result instanceof Error) throw result
    return result
  },
})

async function reset() {
  await Promise.all([db.finTx.clear(), db.finRules.clear(), db.finBalances.clear(), db.settings.clear(), db.meta.clear()])
}

describe('runSync', () => {
  beforeEach(reset)

  it('adds transactions, categorises them, stores the balance and the sync time', async () => {
    await db.finRules.add(rule('REWE', 'groceries'))
    const r = await runSync(fake({
      transactions: [raw('2026-10-02', -1234, 'REWE Markt'), raw('2026-10-03', 250000, 'ACME GmbH', 'LOHN'), raw('2026-10-04', -500, 'Kiosk')],
      balance: { amount: 123456, day: '2026-10-04' }, holder: 'Anas Aleem',
    }), 1000)
    expect(r).toMatchObject({ added: 3, fetched: 3, balance: 123456 })
    const all = await db.finTx.orderBy('day').toArray()
    expect(all.map((t) => t.category)).toEqual(['groceries', 'income', null])
    expect((await db.finBalances.get('2026-10-04'))?.amount).toBe(123456)
    expect((await db.settings.get('finLastSyncAt'))?.value).toBe(1000)
  })

  it('never duplicates and never overwrites notes or manual categories', async () => {
    const batch = { transactions: [raw('2026-10-02', -1234, 'REWE Markt'), raw('2026-10-02', -1234, 'REWE Markt')], balance: null, holder: null }
    await runSync(fake(batch))
    const [first] = await db.finTx.toArray()
    await db.finTx.update(first.id, { note: 'party snacks' })
    await setTxCategory(first.id, 'food')
    const r = await runSync(fake({ ...batch, transactions: [...batch.transactions, raw('2026-10-05', -700, 'Cafe')] }))
    expect(r.added).toBe(1)
    expect(await db.finTx.count()).toBe(3)
    expect(await db.finTx.get(first.id)).toMatchObject({ note: 'party snacks', category: 'food', categorySource: 'manual' })
  })

  it('fetches from a week before the newest transaction, or everything on the first sync', async () => {
    const seen: (string | null)[] = []
    await runSync(fake({ transactions: [raw('2026-10-20', -100, 'x')], balance: null, holder: null }, seen))
    await runSync(fake({ transactions: [], balance: null, holder: null }, seen))
    expect(seen).toEqual([null, '2026-10-13'])
    expect(await syncStartDay()).toBe('2026-10-13')
  })

  it('leaves everything untouched when the bank fails', async () => {
    await runSync(fake({ transactions: [raw('2026-10-02', -1234, 'REWE')], balance: { amount: 5000, day: '2026-10-02' }, holder: null }), 1)
    const before = JSON.stringify([await db.finTx.toArray(), await db.finBalances.toArray(), await db.settings.toArray()])
    for (const err of [new BankError('pin', 'wrong'), new BankError('tan-timeout', 't'), new BankError('unreachable', 'u'), new Error('crash')]) {
      await expect(runSync(fake(err), 2)).rejects.toThrow()
    }
    // A malformed answer is rejected as a whole, not half-stored.
    await expect(runSync(fake({ transactions: [raw('2026-10-09', -100, 'ok'), raw('bad', 1.5, 'x')], balance: null, holder: null }), 3)).rejects.toThrow(BankError)
    expect(JSON.stringify([await db.finTx.toArray(), await db.finBalances.toArray(), await db.settings.toArray()])).toBe(before)
  })
})

describe('rules', () => {
  beforeEach(reset)
  it('"apply to all similar" re-categorises everything except manual choices', async () => {
    await runSync(fake({ transactions: [raw('2026-10-01', -800, 'Döner Haus'), raw('2026-10-08', -900, 'Döner Haus'), raw('2026-10-09', -100, 'Kiosk')], balance: null, holder: null }))
    const [a, b] = await db.finTx.filter((t) => t.payee === 'Döner Haus').sortBy('day')
    await setTxCategory(b.id, 'other')
    await setTxCategory(a.id, 'food')
    await addRule({ field: 'payee', contains: 'Döner Haus', category: 'food' })
    const all = await db.finTx.toArray()
    expect(all.find((t) => t.id === b.id)?.category).toBe('other')
    expect(all.filter((t) => t.category === 'food')).toHaveLength(1)
    await db.finTx.update(b.id, { categorySource: null })
    expect(await recategorizeAll()).toBe(1)
    expect((await db.finTx.get(b.id))?.category).toBe('food')
  })
})

// ---- FinTS connector against a fake Commerzbank -------------------------------------------

const PHOTO_TAN: TanMethod = {
  id: 900, name: 'photoTAN-Verfahren', version: 7, isDecoupled: true, activeTanMediaCount: 0, activeTanMedia: [], tanMediaRequirement: 0,
  decoupled: { maxStatusRequests: 20, waitingSecondsBeforeFirstStatusRequest: 0, waitingSecondsBetweenStatusRequests: 0, manualConfirmationAllowed: false, autoConfirmationAllowed: true },
}

describe('TAN method choice', () => {
  const m = (id: number, name: string, isDecoupled = false) => ({ ...PHOTO_TAN, id, name, isDecoupled })
  it('never picks single-step 999 and prefers photoTAN app approval', () => {
    expect(pickTanMethod([m(999, 'Einschritt'), m(902, 'photoTAN'), m(900, 'photoTAN-Push', true)], null)?.id).toBe(900)
    expect(pickTanMethod([m(999, 'Einschritt'), m(902, 'photoTAN')], null)?.id).toBe(902)
    expect(pickTanMethod([m(999, 'Einschritt')], null)).toBeUndefined()
    expect(pickTanMethod([m(902, 'photoTAN'), m(900, 'photoTAN-Push', true)], 902)?.id).toBe(902)
    expect(pickTanMethod([m(900, 'photoTAN-Push', true)], 999)?.id).toBe(900)
  })
  it('reads the bank code from a German IBAN', () => {
    expect(blzFromIban('DE89 3704 0044 0532 0130 00')).toBe('37040044')
    expect(blzFromIban('NL91ABNA0417164300')).toBeNull()
  })
  it('maps bank answers to clear errors', () => {
    expect(mapBankError([{ code: 9050, text: 'Teilweise fehlerhaft' }, { code: 9931, text: 'PIN falsch' }]).kind).toBe('pin')
    expect(mapBankError([{ code: 9078, text: 'Produkt nicht zugelassen' }]).kind).toBe('product')
    expect(mapBankError([{ code: 9800, text: 'Dialog abgebrochen' }]).message).toContain('Dialog abgebrochen')
  })
})

const IBAN = 'DE89370400440532013000'
const MT940 = [
  ':20:STARTUMSE', ':25:37040044/0532013000', ':28C:00000/001', ':60F:C261001EUR1000,00',
  ':61:2610021002DR12,34N005NONREF', ':86:106?00KARTENZAHLUNG?20REWE SAGT DANKE?3020040000?31DE12500105170648489890?32REWE Markt GmbH',
  ':61:2610031003CR2500,00N051NONREF', ':86:166?00GUTSCHRIFT?20LOHN GEHALT 10/2026?32ACME GmbH',
  ':62F:C261003EUR3487,66', '-',
].join('\r\n')

const msg = (dialog: string, ...segments: string[]) => btoa(`HNHBK:1:3+000000000000+300+${dialog}+1'${segments.join('')}HNHBS:9:1+1'`)

/** Commerzbank stand-in: init, statements that need app approval (pending for `pending` polls), end. */
function fakeBank(opts: { pending?: number; wrongPin?: boolean; neverApprove?: boolean } = {}) {
  const log: string[] = []
  let polls = 0
  setTransport(async (_url, body) => {
    const text = atob(body)
    if (text.includes("'HKEND:")) { log.push('end'); return msg('DLG1', "HIRMG:2:2+0100::Dialog beendet.'") }
    if (/'HKTAN:\d+:\d+\+S/.test(text)) {
      polls++
      log.push('poll')
      if (opts.neverApprove || polls <= (opts.pending ?? 0)) {
        return msg('DLG1', "HIRMG:2:2+0010::Nachricht entgegengenommen.'", "HIRMS:3:2:3+3956::Starke Kundenauthentifizierung noch ausstehend.'", "HITAN:4:7:3+S++REF1'")
      }
      return msg('DLG1', "HIRMG:2:2+0010::Nachricht entgegengenommen.'", "HIRMS:3:2:3+0020::Auftrag ausgeführt.'", `HIKAZ:4:6:3+@${MT940.length}@${MT940}'`)
    }
    if (text.includes("'HKKAZ:")) {
      log.push(text.match(/'HKKAZ:[^']*/)?.[0] ?? 'HKKAZ')
      return msg('DLG1', "HIRMG:2:2+0010::Nachricht entgegengenommen.'", "HIRMS:3:2:4+0030::Auftrag empfangen - Sicherheitsfreigabe erforderlich.'", "HITAN:4:7:4+4++REF1+Bitte bestätigen Sie den Vorgang in Ihrer photoTAN-App.'")
    }
    if (text.includes("'HKIDN:")) {
      log.push('init')
      if (opts.wrongPin) return msg('DLG1', "HIRMG:2:2+9050::Die Nachricht enthält Fehler.'", "HIRMS:3:2:3+9931::PIN falsch. Zugang wird nach 3 Fehlversuchen gesperrt.'")
      return msg('DLG1', "HIRMG:2:2+0010::Nachricht entgegengenommen.'", "HIRMS:3:2:3+3076::Keine starke Authentifizierung erforderlich.'")
    }
    throw new Error(`unexpected request ${text.slice(0, 80)}`)
  })
  return { log }
}

async function seedKnownBank() {
  await setMeta('finBank', {
    key: `37040044|1234567890`, holder: null, tanMethods: [], tanMethodId: 900,
    info: {
      systemId: 'SYS1', bankMessages: [],
      bpd: {
        version: 1, url: 'https://fints.commerzbank.de/fints', countryCode: 280, bankId: '37040044', bankName: 'Commerzbank',
        allowedTransactions: [{ transId: 'HKKAZ', versions: [6], tanRequired: true }, { transId: 'HKSAL', versions: [7], tanRequired: true }],
        maxTransactionsPerMessage: 1, supportedLanguages: [1], supportedHbciVersions: [300],
        supportedTanMethods: [{ ...PHOTO_TAN, id: 999, name: 'Einschritt', isDecoupled: false, version: 6 }, PHOTO_TAN],
        availableTanMethodIds: [900],
      },
      upd: {
        version: 1, usage: 0,
        bankAccounts: [{
          accountNumber: '0532013000', bank: { bankId: '37040044', country: 280 }, iban: IBAN, customerId: '1234567890',
          accountType: 'CheckingAccount', currency: 'EUR', holder1: 'ALEEM, ANAS',
          allowedTransactions: [{ transId: 'HKKAZ', numSignatures: 1 }, { transId: 'HKSAL', numSignatures: 1 }],
        }],
      },
    },
  })
}

function tanUi(abort = new AbortController()) {
  const events: string[] = []
  const ui: TanUi = {
    signal: abort.signal,
    step: (t) => events.push(`step:${t}`),
    waiting: (c) => events.push(`waiting:${c}`),
    askTan: async () => { events.push('ask'); return null },
  }
  return { ui, events, abort }
}

const SETUP = { productId: 'TESTPRODUCT123', iban: IBAN, login: '1234567890', pin: '12345', tanMethodId: null }

describe('Commerzbank connector (fake bank)', () => {
  beforeEach(async () => {
    await reset()
    await seedKnownBank()
    timing.minPollMs = 1
    timing.decoupledTimeoutMs = 5 * 60_000
  })

  it('waits for photoTAN app approval, then stores transactions and the balance', async () => {
    const bank = fakeBank({ pending: 2 })
    const { ui, events } = tanUi()
    const r = await runSync(createFintsConnector(SETUP, ui))
    expect(r).toMatchObject({ added: 2, balance: 348766 })
    expect(events).toContain('waiting:Bitte bestätigen Sie den Vorgang in Ihrer photoTAN-App.')
    expect(bank.log.filter((l) => l === 'poll')).toHaveLength(3)
    const all = await db.finTx.orderBy('day').toArray()
    expect(all.map((t) => [t.day, t.amount, t.payee, t.category])).toEqual([
      ['2026-10-02', -1234, 'REWE Markt GmbH', null], ['2026-10-03', 250000, 'ACME GmbH', 'income'],
    ])
    expect(all[0].payeeIban).toBe('DE12500105170648489890')
  })

  it('asks the bank only from the sync start day on later syncs', async () => {
    const bank = fakeBank()
    await runSync(createFintsConnector(SETUP, tanUi().ui))
    await runSync(createFintsConnector(SETUP, tanUi().ui))
    const [firstAsk, secondAsk] = bank.log.filter((l) => l.startsWith("'HKKAZ"))
    expect(firstAsk).not.toContain('20260926')
    expect(secondAsk).toContain('20260926')
    expect(await db.finTx.count()).toBe(2)
  })

  it('reports a wrong PIN without touching data', async () => {
    fakeBank()
    await runSync(createFintsConnector(SETUP, tanUi().ui))
    fakeBank({ wrongPin: true })
    const err = await runSync(createFintsConnector(SETUP, tanUi().ui)).catch((e) => e)
    expect(err).toBeInstanceOf(BankError)
    expect(err.kind).toBe('pin')
    expect(await db.finTx.count()).toBe(2)
  })

  it('times out when the approval never comes, and can be cancelled', async () => {
    fakeBank({ neverApprove: true })
    timing.decoupledTimeoutMs = 30
    const err = await runSync(createFintsConnector(SETUP, tanUi().ui)).catch((e) => e)
    expect(err.kind).toBe('tan-timeout')
    timing.decoupledTimeoutMs = 60_000
    const t = tanUi()
    setTimeout(() => t.abort.abort(), 20)
    const err2 = await runSync(createFintsConnector(SETUP, t.ui)).catch((e) => e)
    expect(err2.kind).toBe('tan-cancelled')
    expect(await db.finTx.count()).toBe(0)
  })

  it('tries without a registration number and explains a refusal', async () => {
    let sent = ''
    setTransport(async (_url, body) => {
      sent = atob(body)
      return msg('DLG1', "HIRMG:2:2+9050::Die Nachricht enthält Fehler.'", "HIRMS:3:2:3+9010::Verarbeitung nicht möglich.'")
    })
    const err = await runSync(createFintsConnector({ ...SETUP, productId: '' }, tanUi().ui)).catch((e) => e)
    expect(sent).toContain('UNREGISTERED')
    expect(err.kind).toBe('product')
    expect(err.message).toContain('no product registration number')
    // A wrong PIN is still reported as a wrong PIN.
    setTransport(async () => msg('DLG1', "HIRMG:2:2+9050::Fehler.'", "HIRMS:3:2:3+9931::PIN falsch.'"))
    expect((await runSync(createFintsConnector({ ...SETUP, productId: '' }, tanUi().ui)).catch((e) => e)).kind).toBe('pin')
  })

  it('reports an unreachable bank and missing setup clearly', async () => {
    setTransport(async () => { throw new Error('net::ERR_NAME_NOT_RESOLVED') })
    expect((await runSync(createFintsConnector(SETUP, tanUi().ui)).catch((e) => e)).kind).toBe('unreachable')
    expect((await runSync(createFintsConnector({ ...SETUP, iban: 'DE1' }, tanUi().ui)).catch((e) => e)).kind).toBe('setup')
    expect((await runSync(createFintsConnector({ ...SETUP, iban: 'DE89370400440532013999' }, tanUi().ui)).catch((e) => e)).kind).toBe('account')
  })
})
