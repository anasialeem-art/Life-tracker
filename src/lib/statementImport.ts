import type { DayKey } from './day'
import type { RawTx } from './finance'

// Reads bank statement files: the CSV export from Commerzbank online banking (and most
// other German banks' CSVs, matched by column names), plus MT940 (.sta) files.
// Nothing here touches the database; bankSync.commitRows does the safe, add-only write.

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

export interface ParsedStatement {
  format: 'csv' | 'mt940'
  rows: RawTx[]
  /** Lines that looked like data but had no readable date or amount (e.g. a balance footer). */
  skipped: number
  balance: { amount: number; day: DayKey } | null
}

/** UTF-8 when valid, otherwise Windows-1252 (what older bank exports use for umlauts). */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    text = new TextDecoder('windows-1252').decode(data)
  }
  return text.replace(/^﻿/, '')
}

export async function parseStatementFile(bytes: ArrayBuffer | Uint8Array): Promise<ParsedStatement> {
  const text = decodeText(bytes)
  if (!text.trim()) throw new ImportError('This file is empty.')
  if (/^\s*%PDF/.test(text)) {
    throw new ImportError('PDF statements can\'t be read. In Commerzbank online banking, export your transactions as CSV instead.')
  }
  if (/:20:/.test(text) && /:61:/.test(text)) return parseMt940(text)
  return parseCsv(text)
}

// ---- MT940 -----------------------------------------------------------------------------

async function parseMt940(text: string): Promise<ParsedStatement> {
  const [{ Mt940Parser }, { statementsToRaw, closingBalance }] = await Promise.all([import('lib-fints'), import('./fints')])
  let statements
  try {
    statements = new Mt940Parser(text.replace(/\r?\n/g, '\r\n')).parse()
  } catch (e) {
    throw new ImportError(`This MT940 file could not be read (${(e as Error).message}).`)
  }
  const rows = statementsToRaw(statements)
  if (!rows.length) throw new ImportError('No transactions found in this MT940 file.')
  return { format: 'mt940', rows, skipped: 0, balance: closingBalance(statements) }
}

// ---- CSV --------------------------------------------------------------------------------

/** RFC 4180-ish: quoted fields may contain the delimiter, line breaks and doubled quotes. */
export function splitCsv(text: string, delim: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      out.push(row); row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); out.push(row) }
  return out.filter((r) => r.some((f) => f.trim() !== ''))
}

const norm = (h: string) => h.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

/** Column names seen in German bank exports, most specific first. */
const COLUMNS = {
  date: ['buchungstag', 'buchungsdatum', 'datum', 'bookingdate', 'date', 'valutadatum', 'wertstellung', 'valuta'],
  amount: ['betrageur', 'betrag', 'umsatz', 'amount'],
  debit: ['soll', 'ausgang', 'debit', 'lastschrift'],
  credit: ['haben', 'eingang', 'credit', 'gutschrift'],
  sign: ['sollhaben', 'sh', 'kennzeichen'],
  payee: ['beguenstigterzahlungspflichtiger', 'begunstigterzahlungspflichtiger', 'zahlungsempfaengerin', 'zahlungsempfanger', 'zahlungsempfaenger',
    'empfaengerauftraggeber', 'auftraggeberempfaenger', 'auftraggeberbegunstigter', 'name', 'empfanger', 'empfaenger', 'auftraggeber', 'payee', 'counterparty'],
  purpose: ['verwendungszweck', 'buchungstext', 'beschreibung', 'purpose', 'description', 'text'],
  kind: ['umsatzart', 'buchungsart', 'vorgang', 'transactiontype'],
  iban: ['ibanauftraggeberkonto', 'ibangegenkonto', 'kontonummeriban', 'gegenkontoiban', 'iban', 'gegenkonto'],
} as const

type Col = keyof typeof COLUMNS

function findColumns(header: string[]): Partial<Record<Col, number>> {
  const names = header.map(norm)
  const found: Partial<Record<Col, number>> = {}
  const taken = new Set<number>()
  for (const col of Object.keys(COLUMNS) as Col[]) {
    for (const want of COLUMNS[col]) {
      const i = names.findIndex((n, k) => !taken.has(k) && n === want)
      if (i >= 0) { found[col] = i; taken.add(i); break }
    }
  }
  // Second pass: prefixes such as "Betrag (EUR)" → "betrageur", "Buchungstag" variants.
  for (const col of ['date', 'amount', 'payee', 'purpose'] as Col[]) {
    if (found[col] !== undefined) continue
    for (const want of COLUMNS[col]) {
      const i = names.findIndex((n, k) => !taken.has(k) && n.startsWith(want))
      if (i >= 0) { found[col] = i; taken.add(i); break }
    }
  }
  return found
}

/** dd.mm.yyyy, dd.mm.yy, yyyy-mm-dd or dd/mm/yyyy → YYYY-MM-DD. */
export function parseDate(s: string): DayKey | null {
  const t = s.trim()
  let m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return valid(y, Number(m[2]), Number(m[1]))
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? valid(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

function valid(y: number, mo: number, d: number): DayKey | null {
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "-1.234,56", "1,234.56", "12,5 €", "(12.00)" → cents; null if not a number. */
export function parseAmount(s: string): number | null {
  let t = s.replace(/[\s €]|EUR/g, '')
  if (!t) return null
  let neg = false
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1) }
  if (t.endsWith('-')) { neg = true; t = t.slice(0, -1) }
  if (t.startsWith('-') || t.startsWith('−')) { neg = !neg; t = t.slice(1) } else if (t.startsWith('+')) t = t.slice(1)
  // The last separator followed by 1–2 digits is the decimal one; the other kind groups thousands.
  const dec = t.match(/[.,](\d{1,2})$/)
  if (dec) t = `${t.slice(0, -dec[0].length).replace(/[.,]/g, '')}.${dec[1]}`
  else t = t.replace(/[.,](?=\d{3}(\D|$))/g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const cents = Math.round(parseFloat(t) * 100)
  return neg ? -cents : cents
}

/**
 * Commerzbank puts payee and purpose into one "Buchungstext". The name is the part before
 * "//" (card payments: "REWE SAGT DANKE//BERLIN/DE"), before an "End-to-End" reference, or
 * the first few words.
 */
export function payeeFromText(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const cut = t.split(/\/\/| End-to-End| E2E-Ref| Kartenzahlung| Karte Nr| Mandatsref| Gläubiger-ID| Glaeubiger-ID| \d{4}-\d{2}-\d{2}T/i)[0].trim()
  return (cut || t).split(' ').slice(0, 6).join(' ')
}

function parseCsv(text: string): ParsedStatement {
  const firstLines = text.split(/\r?\n/).slice(0, 30)
  const delim = [';', '\t', ','].map((d) => ({ d, n: Math.max(...firstLines.map((l) => l.split(d).length)) })).sort((a, b) => b.n - a.n)[0].d
  const table = splitCsv(text, delim)
  const headerIdx = table.slice(0, 30).findIndex((r) => {
    const c = findColumns(r)
    return c.date !== undefined && (c.amount !== undefined || c.debit !== undefined || c.credit !== undefined)
  })
  if (headerIdx < 0) {
    throw new ImportError('This file doesn\'t look like a bank statement: no date and amount columns found. Export the transactions as CSV from Commerzbank online banking.')
  }
  const cols = findColumns(table[headerIdx])
  const get = (r: string[], c: Col) => (cols[c] !== undefined ? (r[cols[c]!] ?? '').trim() : '')

  const rows: RawTx[] = []
  let skipped = 0
  for (const r of table.slice(headerIdx + 1)) {
    const day = parseDate(get(r, 'date'))
    let amount = cols.amount !== undefined ? parseAmount(get(r, 'amount')) : null
    if (amount === null && (cols.debit !== undefined || cols.credit !== undefined)) {
      const debit = parseAmount(get(r, 'debit'))
      const credit = parseAmount(get(r, 'credit'))
      if (debit !== null || credit !== null) amount = (credit ?? 0) - Math.abs(debit ?? 0)
    }
    if (amount !== null && cols.sign !== undefined && /^s$/i.test(get(r, 'sign'))) amount = -Math.abs(amount)
    if (!day || amount === null) {
      skipped++
      continue
    }
    const text = get(r, 'purpose')
    const payee = get(r, 'payee') || payeeFromText(text) || get(r, 'kind')
    rows.push({ day, amount, payee, payeeIban: get(r, 'iban').replace(/\s/g, ''), purpose: text || get(r, 'kind') })
  }
  if (!rows.length) throw new ImportError('No transactions found in this file.')
  return { format: 'csv', rows, skipped, balance: null }
}
