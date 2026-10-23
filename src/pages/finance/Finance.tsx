import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db, type FinCategory } from '../../lib/db'
import { ensureStarterRules } from '../../lib/finance'
import { navigate } from '../../lib/router'
import { GearIcon } from '../../components/Icons'
import { IconButton, TopBar } from '../../components/TopBar'
import { Segmented, useToast } from '../../components/ui'
import { ImportSheet, type ImportHandle } from './ImportSheet'
import { Insights } from './Insights'
import { Overview } from './Overview'
import { Subscriptions } from './Subscriptions'
import { SyncSheet } from './SyncSheet'
import { Transactions, type TxFilter } from './Transactions'
import { useBankSync } from './useBankSync'

type Section = 'overview' | 'insights' | 'subs' | 'activity'
const SECTIONS: Section[] = ['overview', 'insights', 'subs', 'activity']

function readSection(): Section {
  try {
    const s = localStorage.getItem('finance-section') as Section | null
    return s && SECTIONS.includes(s) ? s : 'overview'
  } catch {
    return 'overview'
  }
}

export function Finance() {
  const [section, setSectionState] = useState<Section>(readSection)
  const [filter, setFilter] = useState<TxFilter>({ month: null, category: 'all', query: '' })
  const txs = useLiveQuery(() => db.finTx.toArray())
  const sync = useBankSync()
  const [toast, showToast] = useToast()
  const importer = useRef<ImportHandle>(null)

  useEffect(() => { ensureStarterRules() }, [])

  const setSection = (s: Section) => {
    setSectionState(s)
    window.scrollTo(0, 0)
    try { localStorage.setItem('finance-section', s) } catch { /* per-device preference only */ }
  }
  const openActivity = (f: Partial<TxFilter>) => {
    setFilter({ month: null, category: 'all', query: '', ...f })
    setSection('activity')
  }

  useEffect(() => {
    if (sync.state.phase !== 'done') return
    const n = sync.state.added
    showToast(n === 0 ? 'Up to date' : `${n} new transaction${n === 1 ? '' : 's'}`)
    sync.reset()
  }, [sync.state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <TopBar title="Finance" backTo="/more" actions={
        <IconButton label="Finance settings" onClick={() => navigate('/more/finance/settings')}><GearIcon size={22} /></IconButton>
      } />
      <div className="mx-auto max-w-xl px-4 pb-3">
        <Segmented value={section} onChange={setSection} size="sm" options={[
          { value: 'overview', label: 'Overview' }, { value: 'insights', label: 'Insights' },
          { value: 'subs', label: 'Subscriptions' }, { value: 'activity', label: 'Activity' },
        ]} />
      </div>
      <div key={section} className="animate-page-in">
        {section === 'overview' && (
          <Overview txs={txs} syncing={sync.state.phase !== 'idle' && sync.state.phase !== 'error'} onSync={() => sync.start()} onImport={() => importer.current?.pick()}
            onOpenActivity={openActivity} onOpenSubs={() => setSection('subs')} />
        )}
        {section === 'insights' && <Insights txs={txs} />}
        {section === 'subs' && <Subscriptions txs={txs} />}
        {section === 'activity' && <Transactions txs={txs} filter={filter} onFilter={setFilter} onImport={() => importer.current?.pick()} />}
      </div>
      <SyncSheet sync={sync} />
      <ImportSheet ref={importer} onImported={(n) => showToast(`${n} transaction${n === 1 ? '' : 's'} imported`)} />
      {toast}
    </>
  )
}

export type OpenActivity = (f: { month?: string | null; category?: FinCategory | 'all' | 'none' }) => void
