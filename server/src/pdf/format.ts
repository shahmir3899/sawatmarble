export function formatMoney(value: string) {
  const num = Number(value);
  return num.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// e.g. 2-Dec-2026
export function formatDate(value: Date) {
  const day = value.getDate();
  const month = value.toLocaleString("en-US", { month: "short" });
  return `${day}-${month}-${value.getFullYear()}`;
}
