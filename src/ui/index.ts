/**
 * Station Ledger — the ACTAS OT Calculator component library.
 *
 * Import the stylesheet once at the app entry point, then wrap the tree in
 * <StationLedger>. See README for the conventions.
 */
import './styles.css'

// Root
export { StationLedger } from './StationLedger'
export type { StationLedgerProps } from './StationLedger'

// Primitives
export { Button } from './Button'
export type { ButtonProps } from './Button'

export { SegmentedControl } from './SegmentedControl'
export type { SegmentedControlProps, SegmentedOption } from './SegmentedControl'

export { Tabs } from './Tabs'
export type { TabsProps, TabItem } from './Tabs'

export { TextField } from './TextField'
export type { TextFieldProps } from './TextField'

export { SelectField } from './SelectField'
export type { SelectFieldProps, SelectOption } from './SelectField'

export { Toggle } from './Toggle'
export type { ToggleProps } from './Toggle'

export { Panel } from './Panel'
export type { PanelProps } from './Panel'

export { UndoRow } from './UndoRow'
export type { UndoRowProps } from './UndoRow'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { Disclosure } from './Disclosure'
export type { DisclosureProps } from './Disclosure'

export { AssumptionNote } from './AssumptionNote'
export type { AssumptionNoteProps } from './AssumptionNote'

export { Money } from './Money'
export type { MoneyProps } from './Money'

export { FigureTable } from './FigureTable'
export type { FigureTableProps, FigureRow } from './FigureTable'

export { InspectableFigure } from './InspectableFigure'
export type { InspectableFigureProps } from './InspectableFigure'

export { Disclaimer } from './Disclaimer'

// Composites
export { ResultPanel } from './ResultPanel'
export type { ResultPanelProps } from './ResultPanel'

export { ShiftRow } from './ShiftRow'
export type { ShiftRowProps, ShiftKind } from './ShiftRow'

export { ShiftList } from './ShiftList'
export type { ShiftListProps } from './ShiftList'

export { Sheet } from './Sheet'
export type { SheetProps } from './Sheet'

export { DerivedPayPanel } from './DerivedPayPanel'
export type { DerivedPayPanelProps } from './DerivedPayPanel'

export { CalculatorLayout } from './CalculatorLayout'
export type { CalculatorLayoutProps } from './CalculatorLayout'

// Formatting
export { formatMoney, formatHours, formatTime, formatKept, MINUS } from './format'
export type { FormatMoneyOptions, MoneySign } from './format'
