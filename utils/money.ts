// utils/money.ts
export type CurrencyCode = "TRY" | "USD" | "EUR" | "GBP";

export type Rates = Record<CurrencyCode, number>; // TCMB ForexSelling: 1 FX = rate TL

const currencyDisplay: Record<
  CurrencyCode,
  { symbol: string; defaultPosition: "prefix" | "suffix" }
> = {
  TRY: { symbol: "₺", defaultPosition: "prefix" },
  USD: { symbol: "$", defaultPosition: "prefix" },
  EUR: { symbol: "€", defaultPosition: "prefix" },
  GBP: { symbol: "£", defaultPosition: "prefix" },
};

export type FormatCurrencyOptions = {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  symbolPosition?: "prefix" | "suffix";
  hideSymbol?: boolean;
};

export function getCurrencySymbol(currency?: CurrencyCode | string | null) {
  if (!currency) return currencyDisplay.TRY.symbol;
  const upper = currency.toUpperCase() as CurrencyCode;
  return currencyDisplay[upper]?.symbol ?? upper;
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode | string = "TRY",
  options?: FormatCurrencyOptions
) {
  const locale = options?.locale ?? "tr-TR";
  const min =
    options?.minimumFractionDigits ?? options?.maximumFractionDigits ?? 2;
  const max =
    options?.maximumFractionDigits ?? options?.minimumFractionDigits ?? 2;

  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const sign = safeAmount < 0 ? "-" : "";
  const absoluteValue = Math.abs(safeAmount);

  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(absoluteValue);

  if (options?.hideSymbol) {
    return `${sign}${formattedNumber}`;
  }

  const symbol = getCurrencySymbol(currency);
  const normalizedCurrency =
    typeof currency === "string" ? currency.toUpperCase() : "TRY";
  const position =
    options?.symbolPosition ??
    currencyDisplay[normalizedCurrency as CurrencyCode]?.defaultPosition ??
    "prefix";

  return position === "suffix"
    ? `${sign}${formattedNumber} ${symbol}`
    : `${sign}${symbol}${formattedNumber}`;
}

/** FX -> TRY (TCMB ForexSelling kullanır: TL = FX * rate) */
export function toTRY(
  amountFX: number,
  code: CurrencyCode,
  rates: Rates
): number {
  if (!amountFX) return 0;
  if (code === "TRY") return amountFX;
  const r = rates?.[code];
  return r && r > 0 ? amountFX * r : 0;
}

/** TRY -> FX (TL / rate) */
export function fromTRY(
  amountTRY: number,
  code: CurrencyCode,
  rates: Rates
): number {
  if (!amountTRY) return 0;
  if (code === "TRY") return amountTRY;
  const r = rates?.[code];
  return r && r > 0 ? amountTRY / r : amountTRY;
}

/** Sayıyı seçilen para biriminde formatlar */
export function formatIn(
  amount: number,
  currency: CurrencyCode,
  locale: string = "tr-TR"
): string {
  return formatCurrency(amount, currency, { locale });
}

/** Global iskonto & vergi: amount değerleri TRY varsayılır, percentage TRY üzerinden hesaplanır */
export function applyGlobalDiscountTaxTRY(
  subTotalTRY: number,
  globalDiscount: { type: "percentage" | "amount"; value: number } | null,
  globalTax: { type: "percentage" | "amount"; value: number } | null
) {
  let discountTRY = 0;
  if (globalDiscount) {
    discountTRY =
      globalDiscount.type === "percentage"
        ? (subTotalTRY * (globalDiscount.value || 0)) / 100
        : Math.max(globalDiscount.value || 0, 0);
  }

  const baseForTax = Math.max(subTotalTRY - discountTRY, 0);

  let taxTRY = 0;
  if (globalTax) {
    taxTRY =
      globalTax.type === "percentage"
        ? (baseForTax * (globalTax.value || 0)) / 100
        : Math.max(globalTax.value || 0, 0);
  }

  const finalTRY = Math.max(baseForTax + taxTRY, 0);
  return { discountTRY, taxTRY, finalTRY };
}
