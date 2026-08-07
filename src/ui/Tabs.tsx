export interface TabItem<T extends string = string> {
  value: T
  label: string
}

export interface TabsProps<T extends string = string> {
  label: string
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
}

/** The Quick / Fortnight switch. Underline selection, no pill chrome. */
export function Tabs<T extends string = string>({
  label,
  items,
  value,
  onChange,
}: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="sl-tabs">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className="sl-tabs__tab"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
