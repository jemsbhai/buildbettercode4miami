export function formatMetric(value: number, unit: string) {
  return unit === "USD"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
