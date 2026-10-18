import { useState } from 'react'
import { isFuture } from '../lib/day'
import { useToday } from '../lib/useToday'
import { DayNav } from '../components/DayNav'
import { TopBar } from '../components/TopBar'
import { Card, EmptyState, Page } from '../components/ui'

/** Stand-in for tabs not built yet. Day navigation is live so the 05:00 rollover can be tested on the device. */
export function Placeholder({ title, step, withDayNav = false }: { title: string; step: number; withDayNav?: boolean }) {
  const today = useToday()
  const [day, setDay] = useState(today)

  return (
    <>
      <TopBar title={title} />
      <Page>
        {withDayNav && <DayNav day={day} today={today} onChange={setDay} />}
        <Card>
          <EmptyState title={`${title} arrives in build step ${step}`}>
            {withDayNav && isFuture(day) ? 'Future days are locked.' : 'The shell, storage and backup are ready.'}
          </EmptyState>
        </Card>
      </Page>
    </>
  )
}
