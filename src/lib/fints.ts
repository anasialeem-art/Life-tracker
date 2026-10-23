import { Buffer } from 'buffer'
import {
  Dialog, FinTSClient, FinTSConfig, Message,
  type BankAccount, type BankAnswer, type BankingInformation, type BPD, type ClientResponse, type Statement,
} from 'lib-fints'
import { BankError, type BankConnector, type BankFetchResult } from './bankSync'
import { calendarKey, parseKey, type DayKey } from './day'
import { getMeta, setMeta } from './db'
import { blzFromIban, normIban, type RawTx } from './finance'
import { HttpStatusError, nativePost } from './native'

// Commerzbank over FinTS 3.0 PIN/TAN, read-only: the only orders this file ever
// sends are dialog setup, account statements (HKKAZ/HKCAZ) and balance (HKSAL).
// lib-fints has no payment orders at all.

export const COMMERZBANK_URL = 'https://fints.commerzbank.de/fints'
export const PRODUCT_VERSION = '1.0'

// lib-fints decodes CAMT statements with Node's Buffer; give the WebView one.
;(globalThis as { Buffer?: unknown }).Buffer ??= Buffer

export type TanMethod = BPD['supportedTanMethods'][number]

/** How a FinTS message travels: the body is the base64 message, the answer base64 too. */
export type Transport = (url: string, body: string) => Promise<string>
let transport: Transport = nativePost
/** Tests swap in a fake bank. */
export function setTransport(t: Transport) { transport = t }

/** Latin-1 string → base64, without Node. FinTS messages are ISO-8859-1. */
export function latin1ToBase64(s: string): string {
  return btoa(s.replace(/[^\x00-\xff]/g, '?'))
}
export function base64ToLatin1(b64: string): string {
  return atob(b64.replace(/\s+/g, ''))
}

type OutgoingMessage = Message & { encode(): string; supportsPartedResponseSegments?: boolean; orderResponseSegId?: string }

/** Replaces lib-fints' fetch()-based client so every bank request goes through the native HTTP stack. */
class TransportHttpClient {
  constructor(private url: string) {}
  async sendMessage(message: OutgoingMessage): Promise<Message> {
    let answer: string
    try {
      answer = await transport(this.url, latin1ToBase64(message.encode()))
    } catch (e) {
      const detail = e instanceof HttpStatusError ? `HTTP ${e.status}` : (e as Error).message
      throw new BankError('unreachable', 'Could not reach Commerzbank. Check your internet connection and try again.', detail)
    }
    try {
      return Message.decode(base64ToLatin1(answer), message.supportsPartedResponseSegments ? message.orderResponseSegId : undefined)
    } catch (e) {
      throw new BankError('bank', 'The bank sent an answer the app could not read. Nothing was changed.', (e as Error).message)
    }
  }
}
;(Dialog.prototype as unknown as { getHttpClient: () => unknown }).getHttpClient = function (this: Dialog) {
  return new TransportHttpClient(this.config.bankingUrl)
}

// ---- TAN ----------------------------------------------------------------------------

export interface TanUi {
  signal: AbortSignal
  /** Progress line for the sync screen. */
  step(text: string): void
  /** Decoupled photoTAN: show "Approve in the photoTAN app" while the app polls. */
  waiting(challenge: string): void
  /** Classic TAN entry (photoTAN image to scan elsewhere); null = cancelled. */
  askTan(challenge: string, photo?: { mimeType: string; image: Uint8Array }): Promise<string | null>
}

/**
 * The bank's advertised two-step method, never the single-step 999 the dialog
 * starts with. Prefers photoTAN with app approval (decoupled), then any decoupled
 * method, then photoTAN, then whatever else the bank allows.
 */
export function pickTanMethod(methods: TanMethod[], preferred: number | null): TanMethod | undefined {
  const usable = methods.filter((m) => m.id !== 999)
  if (preferred !== null) {
    const p = usable.find((m) => m.id === preferred)
    if (p) return p
  }
  const photo = (m: TanMethod) => /photo/i.test(m.name)
  return usable.find((m) => m.isDecoupled && photo(m)) ?? usable.find((m) => m.isDecoupled) ?? usable.find(photo) ?? usable[0]
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(cancelled())
  const t = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => { clearTimeout(t); reject(cancelled()) }, { once: true })
})
const cancelled = () => new BankError('tan-cancelled', 'Sync cancelled. Nothing was changed.')

/** Overall limit for approving in the photoTAN app, and the shortest pause between status checks. */
export const timing = { decoupledTimeoutMs: 5 * 60_000, minPollMs: 2000 }

/** Runs a bank step to completion, handling as many TAN rounds as the bank asks for. */
export async function withTan<T extends ClientResponse>(
  first: T,
  cont: (ref: string, tan?: string) => Promise<T>,
  method: TanMethod | undefined,
  ui: TanUi,
  now: () => number = Date.now,
): Promise<T> {
  let r = first
  while (r.success && r.requiresTan) {
    if (ui.signal.aborted) throw cancelled()
    const ref = r.tanReference
    if (!ref) throw new BankError('bank', 'The bank asked for a TAN without a reference.', bankText(r.bankAnswers))
    if (method?.isDecoupled) {
      ui.waiting(r.tanChallenge ?? '')
      const p = method.decoupled
      const firstWait = Math.max(timing.minPollMs, (p?.waitingSecondsBeforeFirstStatusRequest ?? 5) * 1000)
      const between = Math.max(timing.minPollMs, (p?.waitingSecondsBetweenStatusRequests ?? 3) * 1000)
      const maxPolls = p?.maxStatusRequests && p.maxStatusRequests > 0 ? p.maxStatusRequests : 100
      const started = now()
      let polls = 0
      for (;;) {
        await sleep(polls === 0 ? firstWait : between, ui.signal)
        r = await cont(ref)
        polls++
        if (!r.success || !r.requiresTan) break
        // 3956 = "not approved yet": keep polling the same order.
        if (polls >= maxPolls || now() - started > timing.decoupledTimeoutMs) {
          throw new BankError('tan-timeout', 'The photoTAN approval timed out. Nothing was changed. Tap Sync to try again.')
        }
      }
    } else {
      const tan = await ui.askTan(r.tanChallenge ?? '', r.tanPhoto)
      if (!tan) throw cancelled()
      r = await cont(ref, tan.trim())
    }
  }
  if (!r.success) throw mapBankError(r.bankAnswers)
  return r
}

// ---- Errors ----------------------------------------------------------------------

const bankText = (answers: BankAnswer[]) => answers.map((a) => `${a.code} ${a.text}`).join(' · ')

/** Turns the bank's return codes into a message a person can act on. */
export function mapBankError(answers: BankAnswer[]): BankError {
  const errors = answers.filter((a) => a.code >= 9000)
  const all = errors.length ? errors : answers
  const text = bankText(all)
  const has = (...codes: number[]) => all.some((a) => codes.includes(a.code))
  const says = (re: RegExp) => all.some((a) => re.test(a.text))
  if (has(9078) || says(/produkt/i)) {
    return new BankError('product', 'Commerzbank did not accept the product registration number. Check it in Finance settings (new numbers can take a few weeks to work).', text)
  }
  // "PIN falsch … wird nach 3 Fehlversuchen gesperrt" is a wrong PIN, not a lock, so PIN comes first.
  const pin = () => new BankError('pin', 'Wrong login number or PIN. Check them in Finance settings. Careful: several wrong tries lock your access.', text)
  if (has(9931, 9942, 9340, 9930)) return pin()
  if (has(3938, 9938) || says(/(zugang|konto|pin|kennung)[^.]*\b(ist|wurde)\b[^.]*gesperrt|gesperrt\.?$/i)) {
    return new BankError('locked', 'Commerzbank reports that online access is blocked. Unblock it in the Commerzbank app or with the bank, then try again.', text)
  }
  if (says(/pin[^.]*(falsch|ungültig|ungueltig)|(falsch|ungültig)[^.]*pin|anmelde[^.]*(fehl|ungültig)|kennung[^.]*(falsch|ungültig)/i)) return pin()
  if (says(/tan.*(falsch|ungültig|abgelehnt|storniert|abgebrochen)|(abgelehnt|storniert).*(auftrag|freigabe)/i)) {
    return new BankError('tan-rejected', 'The TAN was not accepted or the approval was declined. Nothing was changed.', text)
  }
  return new BankError('bank', `The bank reported a problem: ${all.map((a) => a.text).join(' ') || 'unknown error'}. Nothing was changed.`, text)
}

// ---- Mapping ------------------------------------------------------------------------

const centsOf = (v: number) => Math.round(v * 100)

export function statementsToRaw(statements: Statement[]): RawTx[] {
  const out: RawTx[] = []
  for (const s of statements) {
    for (const t of s.transactions ?? []) {
      const date = t.entryDate ?? t.valueDate
      if (!(date instanceof Date) || isNaN(date.getTime())) continue
      out.push({
        day: calendarKey(date),
        amount: centsOf(t.amount),
        payee: t.remoteName ?? '',
        payeeIban: normIban(t.remoteAccountNumber ?? ''),
        purpose: t.purpose || t.bookingText || '',
      })
    }
  }
  return out
}

/** Closing balance of the newest statement day. */
export function closingBalance(statements: Statement[]): { amount: number; day: DayKey } | null {
  let best: { amount: number; day: DayKey } | null = null
  for (const s of statements) {
    const b = s.closingBalance
    if (!b || !(b.date instanceof Date) || isNaN(b.date.getTime()) || typeof b.value !== 'number') continue
    const day = calendarKey(b.date)
    if (!best || day >= best.day) best = { amount: centsOf(b.value), day }
  }
  return best
}

// ---- Connector ----------------------------------------------------------------------

export interface FintsSetup {
  productId: string
  iban: string
  login: string
  pin: string
  tanMethodId: number | null
}

/** Device-local bank state (not part of backups): BPD/UPD, system id, the TAN methods offered. */
interface StoredBank {
  key: string
  info: BankingInformation
  tanMethods: { id: number; name: string; decoupled: boolean }[]
  tanMethodId: number | null
  holder?: string | null
}

/** Sent when no registration number is set yet: honestly unregistered, not borrowed from another product. */
export const UNREGISTERED_PRODUCT = 'UNREGISTERED'

export function createFintsConnector(setup: FintsSetup, ui: TanUi, log: (line: string) => void = () => {}): BankConnector {
  const registered = setup.productId.trim() !== ''
  const fetchWith = fetchStatements(setup, registered ? setup.productId.trim() : UNREGISTERED_PRODUCT, ui, log)
  return {
    async fetch(from) {
      if (!registered) log('No product registration number set; trying without one')
      try {
        return await fetchWith(from)
      } catch (e) {
        // Without a registration number a refusal is almost always about that; say so plainly.
        if (!registered && e instanceof BankError && (e.kind === 'bank' || e.kind === 'product')) {
          throw new BankError('product', 'Commerzbank refused the connection, most likely because the app has no product registration number yet. Add it in Finance settings once you have it. Until then you can import statements.', e.detail || e.message)
        }
        throw e
      }
    },
  }
}

function fetchStatements(setup: FintsSetup, productId: string, ui: TanUi, log: (line: string) => void) {
  return async (from: DayKey | null): Promise<BankFetchResult> => {
    const blz = blzFromIban(setup.iban)
    if (!blz) throw new BankError('setup', 'Add your Commerzbank IBAN (DE…) in Finance settings first.')
    if (!setup.login || !setup.pin) throw new BankError('setup', 'Add your login number and PIN in Finance settings first.')

    const key = `${blz}|${setup.login}`
    const stored = await getMeta<StoredBank>('finBank')
    const known = stored?.key === key && stored.info?.bpd && stored.info?.upd ? stored : null

    let config: FinTSConfig
    let client: FinTSClient
    let method: TanMethod | undefined

    if (known) {
      config = FinTSConfig.fromBankingInformation(productId, PRODUCT_VERSION, known.info, setup.login, setup.pin)
      client = new FinTSClient(config)
      method = pickTanMethod(tanMethodsOf(config), setup.tanMethodId)
      if (method) selectMethod(config, method)
      log(`Using saved bank parameters; TAN method ${method ? `${method.id} ${method.name}` : 'none'}`)
    } else {
      ui.step('Connecting to Commerzbank…')
      config = FinTSConfig.forFirstTimeUse(productId, PRODUCT_VERSION, COMMERZBANK_URL, blz, setup.login, setup.pin)
      client = new FinTSClient(config)
      const first = await client.synchronize()
      log(`Sync 1: ${bankText(first.bankAnswers)}`)
      if (!first.success) throw mapBankError(first.bankAnswers)
      const methods = tanMethodsOf(config)
      log(`TAN methods offered: ${methods.map((m) => `${m.id} ${m.name}${m.isDecoupled ? ' (app approval)' : ''}`).join(', ') || 'none'}`)
      method = pickTanMethod(methods, setup.tanMethodId)
      if (!method) throw new BankError('bank', 'Commerzbank did not offer a usable TAN method for this login. Check that photoTAN is set up.')
      selectMethod(config, method)
      log(`Selected TAN method ${method.id} ${method.name}`)
      ui.step('Signing in…')
      const second = await withTan(await client.synchronize(), (ref, tan) => client.synchronizeWithTan(ref, tan), method, ui)
      log(`Sync 2: ${bankText(second.bankAnswers)}`)
    }

    const accounts = config.bankingInformation.upd?.bankAccounts ?? []
    const want = normIban(setup.iban)
    const account: BankAccount | undefined = accounts.find((a) => normIban(a.iban ?? '') === want)
    if (!account) {
      throw new BankError('account', 'This IBAN was not found among the accounts Commerzbank lists for your login. Check the IBAN in Finance settings.',
        accounts.map((a) => a.iban).join(', '))
    }
    if (!client.canGetAccountStatements(account)) {
      throw new BankError('bank', 'Commerzbank does not offer transaction downloads for this account over FinTS.')
    }

    ui.step(from ? 'Fetching new transactions…' : 'Fetching your transaction history…')
    // Noon, so the date survives lib-fints' UTC formatting in any time zone.
    const fromDate = from ? new Date(parseKey(from).setHours(12)) : undefined
    // MT940 first: the long-established format; CAMT is used when that is all the bank offers.
    const statementsResp = await withTan(
      await client.getAccountStatements(account, fromDate, undefined, false),
      (ref, tan) => client.getAccountStatementsWithTan(ref, tan), method, ui,
    )
    log(`Statements: ${bankText(statementsResp.bankAnswers)}`)
    const statements = statementsResp.statements ?? []
    const transactions = statementsToRaw(statements)
    let balance = closingBalance(statements)

    if (!balance && client.canGetAccountBalance(account)) {
      ui.step('Fetching balance…')
      const b = await withTan(await client.getAccountBalance(account), (ref, tan) => client.getAccountBalanceWithTan(ref, tan), method, ui)
      log(`Balance: ${bankText(b.bankAnswers)}`)
      if (b.balance && typeof b.balance.balance === 'number') {
        balance = { amount: centsOf(b.balance.balance), day: calendarKey(b.balance.date instanceof Date ? b.balance.date : new Date()) }
      }
    }

    const holder = account.holder1 ?? null
    await setMeta('finBank', {
      key, info: config.bankingInformation, holder,
      tanMethods: tanMethodsOf(config).map((m) => ({ id: m.id, name: m.name, decoupled: m.isDecoupled })),
      tanMethodId: method?.id ?? null,
    } satisfies StoredBank)
    log(`Fetched ${transactions.length} transactions; balance ${balance ? `${balance.amount / 100} on ${balance.day}` : 'not sent'}`)
    return { transactions, balance, holder }
  }
}

function tanMethodsOf(config: FinTSConfig): TanMethod[] {
  const available = config.availableTanMethods
  if (available.length) return available
  // Some banks leave out the 3920 list; then every method in the BPD except single-step is a candidate.
  return (config.bankingInformation.bpd?.supportedTanMethods ?? []).filter((m) => m.id !== 999)
}

function selectMethod(config: FinTSConfig, method: TanMethod) {
  const bpd = config.bankingInformation.bpd
  if (bpd && !bpd.availableTanMethodIds?.includes(method.id)) bpd.availableTanMethodIds = [...(bpd.availableTanMethodIds ?? []), method.id]
  config.selectTanMethod(method.id)
  if (method.activeTanMedia?.length === 1) config.selectTanMedia(method.activeTanMedia[0])
}
