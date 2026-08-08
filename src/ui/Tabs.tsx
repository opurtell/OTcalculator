import { rovingKeyDown } from './roving'

export interface TabItem<T extends string = string> {
  value: T
  label: string
}

export interface TabsProps<T extends string = string> {
  label: string
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /**
   * Ties each tab to the panel it controls. The panel is rendered by the
   * caller — the tabs sit above the layout, the body sits inside it — so the
   * ids are derived from a shared base rather than passed back and forth:
   * tab `${idBase}-tab-${value}`, panel `${idBase}-panel-${value}`. Use
   * `tabPanelId` for the other half.
   *
   * Optional: a tab strip with no panel (a preview card, say) simply omits the
   * relationship rather than pointing at an id that does not exist.
   */
  idBase?: string
}

/** The id of the panel a tab controls. The caller's half of `idBase`. */
export function tabPanelId(idBase: string, value: string): string {
  return `${idBase}-panel-${value}`
}

/** The id of the tab that labels a panel. */
export function tabId(idBase: string, value: string): string {
  return `${idBase}-tab-${value}`
}

/**
 * The Quick / Fortnight switch. Underline selection, no pill chrome.
 *
 * One tab stop for the strip, arrow keys within it (§8) — see `roving.ts`.
 */
export function Tabs<T extends string = string>({
  label,
  items,
  value,
  onChange,
  idBase,
}: TabsProps<T>) {
  const selected = items.findIndex((item) => item.value === value)

  return (
    <div role="tablist" aria-label={label} className="sl-tabs">
      {items.map((item, index) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          id={idBase ? tabId(idBase, item.value) : undefined}
          aria-controls={idBase ? tabPanelId(idBase, item.value) : undefined}
          aria-selected={item.value === value}
          // The unselected tabs leave the tab order: the strip is one control,
          // and Tab should move past it rather than through it.
          tabIndex={index === selected ? 0 : -1}
          className="sl-tabs__tab"
          onClick={() => onChange(item.value)}
          onKeyDown={(event) =>
            rovingKeyDown(event, {
              role: 'tab',
              count: items.length,
              current: selected,
              onSelect: (next) => onChange(items[next].value),
            })
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
