export function formatMoney(value: string) {
  const num = Number(value);
  return num.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
