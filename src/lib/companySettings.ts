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
  const code = (currencyCode || "USD").toUpperCase();
  const symbolOverride = currencySymbol?.trim();

  const symbolMap: Record<string, string> = {
    NGN: "₦",
    USD: "$",
    EUR: "€",
    GBP: "£",
    GHS: "₵",
    KES: "KSh",
    ZAR: "R",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
  };

  const symbol = symbolMap[symbolOverride?.toUpperCase() ?? ""] || symbolOverride || symbolMap[code] || "$";
  const absoluteAmount = Math.abs(normalizedAmount);
  const formattedNumber = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absoluteAmount);
  const sign = normalizedAmount < 0 ? "-" : "";

  return `${sign}${symbol}${formattedNumber}`;
};
