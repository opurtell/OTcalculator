// @vitest-environment jsdom
/**
 * The props a host app uses to embed the calculator (the ACTAS Pay Tracker).
 *
 * These need real events, so this file runs under jsdom — the rest of the
 * suite stays on react-dom/server (see vite.config.ts).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CHOICES } from '../../app/settings'
import { Calculator } from '../Calculator'

afterEach(cleanup)

describe('createShiftId', () => {
  it('gives a newly added shift the id from createShiftId', () => {
    const onShiftsChange = vi.fn()
    render(
      <Calculator
        startAtSetup={false}
        createShiftId={() => 'uuid-from-host'}
        onShiftsChange={onShiftsChange}
        payDate="2026-10-22"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add ot shift/i }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '07:00' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: /^add shift$/i }))

    const last = onShiftsChange.mock.calls.at(-1)?.[0] as readonly { id: string }[]
    expect(last.map((s) => s.id)).toEqual(['uuid-from-host'])
  })
})

describe('embedded mode', () => {
  const lastFortnight = {
    fortnight: { start: '2026-09-24', end: '2026-10-07' },
    shifts: [{ id: 'old', date: '2026-10-01', startMin: 420, endMin: 660, endsNextDay: false, kind: 'separate' as const }],
    choices: DEFAULT_CHOICES,
  }

  it('hides clear-settings, the last-fortnight banner and the expiry note', () => {
    render(
      <Calculator
        embedded
        startAtSetup={false}
        shiftsExpired
        lastFortnight={lastFortnight}
        onClearSettings={() => {}}
        payDate="2026-10-22"
      />,
    )
    expect(screen.queryByRole('button', { name: /clear saved settings/i })).toBeNull()
    expect(screen.queryByText(/last pay fortnight/i)).toBeNull()
    expect(screen.queryByText(/cleared/i)).toBeNull()
  })

  it('does not say the shifts are saved on this device', () => {
    render(
      <Calculator
        embedded
        startAtSetup={false}
        initialShifts={[{ id: 'a', date: '2026-10-15', startMin: 420, endMin: 660, endsNextDay: false, kind: 'separate' }]}
        payDate="2026-10-22"
      />,
    )
    expect(screen.queryByText(/saved on this device/i)).toBeNull()
  })

  it('drops the device-storage and privacy wording from the setup screen', () => {
    render(<Calculator embedded startAtSetup payDate="2026-10-22" />)
    expect(screen.getByRole('heading', { name: /set your pay band/i })).not.toBeNull()
    expect(screen.queryByText(/remember it on this device/i)).toBeNull()
    expect(screen.queryByText(/leaves this device/i)).toBeNull()
  })

  it('renders the host note', () => {
    render(<Calculator embedded embeddedNote={<p>2 other work events</p>} startAtSetup={false} payDate="2026-10-22" />)
    expect(screen.getByText('2 other work events')).not.toBeNull()
  })

  it('ignores the host note when not embedded', () => {
    render(<Calculator embeddedNote={<p>2 other work events</p>} startAtSetup={false} payDate="2026-10-22" />)
    expect(screen.queryByText('2 other work events')).toBeNull()
  })

  it('standalone still shows clear-settings, the banner, the expiry note and the setup copy', () => {
    render(
      <Calculator
        startAtSetup={false}
        shiftsExpired
        lastFortnight={lastFortnight}
        onClearSettings={() => {}}
        payDate="2026-10-22"
      />,
    )
    expect(screen.getByRole('button', { name: /clear saved settings/i })).not.toBeNull()
    expect(screen.getByRole('heading', { name: /last pay fortnight/i })).not.toBeNull()
    expect(screen.getAllByText(/cleared/i).length).toBeGreaterThan(0)
    cleanup()
    render(<Calculator startAtSetup payDate="2026-10-22" />)
    expect(screen.getByText(/remember it on this device/i)).not.toBeNull()
    expect(screen.getByText(/leaves this device/i)).not.toBeNull()
  })
})

describe('embedded mode is full-time only', () => {
  const casual = { ...DEFAULT_CHOICES, employment: 'casual' as const, pathway: 'fortnight' as const }
  const shift = { id: 'a', date: '2026-10-15', startMin: 420, endMin: 660, endsNextDay: false, kind: 'separate' as const }

  it('offers no employment toggle on the embedded setup screen', () => {
    render(<Calculator embedded startAtSetup payDate="2026-10-22" />)
    expect(screen.queryByRole('radio', { name: 'Casual' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Full-time' })).toBeNull()
    expect(screen.queryByText(/remember it on this device/i)).toBeNull()
    expect(screen.queryByText(/leaves this device/i)).toBeNull()
  })

  it('offers no employment toggle in the embedded settings panel', () => {
    render(<Calculator embedded initialChoices={casual} startAtSetup={false} payDate="2026-10-22" />)
    // The settings disclosure starts closed, so look inside hidden content too.
    expect(screen.queryByRole('radio', { name: 'Casual', hidden: true })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Full-time', hidden: true })).toBeNull()
  })

  it('treats a casual choice from the host as full-time', () => {
    render(
      <Calculator
        embedded
        embeddedNote={<p>2 other work events</p>}
        initialChoices={casual}
        initialShifts={[shift]}
        startAtSetup={false}
        payDate="2026-10-22"
      />,
    )
    expect(screen.getByText('2 other work events')).not.toBeNull()
    expect(screen.getByText(/overtime shifts/i)).not.toBeNull()
    expect(screen.queryByText(/casual/i)).toBeNull()
    expect(screen.queryByText(/saved on this device/i)).toBeNull()
  })

  it('emits full-time to the host, even when the host passed casual', () => {
    const onChoicesChange = vi.fn()
    render(
      <Calculator embedded initialChoices={casual} startAtSetup onChoicesChange={onChoicesChange} payDate="2026-10-22" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const last = onChoicesChange.mock.calls.at(-1)?.[0] as { employment: string } | undefined
    expect(last?.employment).toBe('full-time')
  })

  it('standalone still offers the employment toggle on setup and in settings', () => {
    render(<Calculator startAtSetup payDate="2026-10-22" />)
    expect(screen.getByRole('radio', { name: 'Casual' })).not.toBeNull()
    cleanup()
    render(<Calculator startAtSetup={false} payDate="2026-10-22" />)
    expect(screen.getByRole('radio', { name: 'Casual', hidden: true })).not.toBeNull()
  })

  it('standalone still emits a casual choice', () => {
    const onChoicesChange = vi.fn()
    render(<Calculator startAtSetup onChoicesChange={onChoicesChange} payDate="2026-10-22" />)
    fireEvent.click(screen.getByRole('radio', { name: 'Casual' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const last = onChoicesChange.mock.calls.at(-1)?.[0] as { employment: string } | undefined
    expect(last?.employment).toBe('casual')
  })
})
