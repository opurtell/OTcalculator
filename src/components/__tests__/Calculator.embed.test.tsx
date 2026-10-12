// @vitest-environment jsdom
/**
 * The props a host app uses to embed the calculator (the ACTAS Pay Tracker).
 *
 * These need real events, so this file runs under jsdom — the rest of the
 * suite stays on react-dom/server (see vite.config.ts).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
