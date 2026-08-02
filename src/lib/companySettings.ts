export const getStockStatus = (stockQuantity: number, threshold = 10) => {
  if (stockQuantity <= 0) return "out_of_stock";
  if (stockQuantity <= threshold) return "low_stock";
  return "in_stock";
};

export const formatCurrency = (
  amount: number,
  currencySymbol = "$",
  currencyCode = "USD"
) => {
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  const symbol = currencySymbol || "$";
  const code = currencyCode || "USD";

  if (code === "NGN" || code === "USD" || code === "EUR" || code === "GBP") {
    return `${symbol}${normalizedAmount.toFixed(2)}`;
  }

  return `${symbol}${normalizedAmount.toFixed(2)} ${code}`;
};
