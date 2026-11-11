export function formatValue(value: number, unit: string | null): string {
  const abs = Math.abs(value)
  const text =
    abs >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : String(Number(value.toPrecision(3)))
  return unit ? `${text} ${unit}` : text
}
