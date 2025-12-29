import type { ReceiptContentLine } from "@/hooks/useThermalPrinter";
import { fromTRY, toTRY, type CurrencyCode, type Rates } from "@/utils/money";

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const formatReceiptMoney = (
  value: number,
  currency: string = "TRY"
): string => {
  const normalizedCurrency = currency?.toUpperCase?.() ?? "TRY";
  const displayCurrency = normalizedCurrency === "TRY" ? "TL" : normalizedCurrency;
  const amount = Math.abs(value ?? 0).toFixed(2);
  const formatted = `${amount}${
    displayCurrency ? ` ${displayCurrency}` : ""
  }`;
  return value < 0 ? `-${formatted}` : formatted;
};

export const hasMeaningfulAmount = (value: number, epsilon = 0.005): boolean =>
  Math.abs(value) >= epsilon;

export const formatPercentage = (value: number): string | null => {
  if (!Number.isFinite(value)) return null;
  const normalized = Number(Math.abs(value).toFixed(2));
  if (!Number.isFinite(normalized)) {
    return null;
  }
  return normalized % 1 === 0
    ? normalized.toFixed(0)
    : normalized.toString();
};

export type ReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  subtotal?: number;
};

export type ReceiptMetaRow = {
  label: string;
  value?: string | number | null;
};

export type BuildReceiptLinesOptions = {
  tenantHeaderLines?: ReceiptContentLine[];
  title?: string;
  orderNumber?: string | null;
  createdAtText?: string | null;
  customerName?: string | null;
  sellerName?: string | null;
  extraMetaRows?: ReceiptMetaRow[];
  items: ReceiptItem[];
  itemsEmptyMessage?: string;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
  paid: number;
  remaining: number;
  paymentLabel?: string | null;
  thankYouMessage?: string | null;
  receiptWidth: number;
  receiptIndent: number;
  currency?: string;
  changeAmount?: number;
  targetCurrency?: CurrencyCode;
  rates?: Rates;
  paidCurrency?: CurrencyCode;
  summaryAlreadyTarget?: boolean;
};

export const buildStandardReceiptLines = (
  options: BuildReceiptLinesOptions
): ReceiptContentLine[] => {
  const {
    tenantHeaderLines = [],
    title = "Satış Fişi",
    orderNumber,
    createdAtText,
    customerName,
    sellerName,
    extraMetaRows = [],
    items,
    itemsEmptyMessage = "Ürün bulunamadı.",
    subtotal,
    totalDiscount,
    totalTax,
    total,
    paid,
    remaining,
    paymentLabel,
    thankYouMessage = "Teşekkür ederiz!",
    receiptWidth,
    receiptIndent,
    currency = "TRY",
    targetCurrency = "TRY",
    rates,
    changeAmount,
    paidCurrency,
    summaryAlreadyTarget = false,
  } = options;

  const normalizeCurrency = (value?: string): CurrencyCode => {
    const normalized = value?.toUpperCase?.() ?? "TRY";
    return ["TRY", "USD", "EUR", "GBP"].includes(normalized)
      ? (normalized as CurrencyCode)
      : "TRY";
  };

  const resolvedTargetCurrency = normalizeCurrency(targetCurrency);
  const convertAmount = (value: number, from?: string): number => {
    const numeric = Number.isFinite(value) ? Number(value) : 0;
    const sourceCurrency = normalizeCurrency(from ?? currency);
    if (
      sourceCurrency === resolvedTargetCurrency ||
      !rates ||
      numeric === 0
    ) {
      return numeric;
    }
    if (resolvedTargetCurrency === "TRY") {
      return toTRY(numeric, sourceCurrency, rates);
    }
    if (sourceCurrency === "TRY") {
      return fromTRY(numeric, resolvedTargetCurrency, rates);
    }
    const amountInTRY = toTRY(numeric, sourceCurrency, rates);
    return fromTRY(amountInTRY, resolvedTargetCurrency, rates);
  };

  const formatDisplayMoney = (value: number) =>
    formatReceiptMoney(value, resolvedTargetCurrency);

  const convertSummaryAmount = (value: number, currencyOverride?: string) => {
    if (summaryAlreadyTarget) {
      return Number.isFinite(value) ? Number(value) : 0;
    }
    return convertAmount(value, currencyOverride);
  };

  const toCenteredLine = (
    value: string,
    preset?: "normal" | "medium" | "large"
  ): ReceiptContentLine => {
    const width = Math.max(receiptWidth, 1);
    const safeValue = (value ?? "").trim();
    const text = safeValue.slice(0, width);
    const padding = Math.max(width - text.length, 0);
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return {
      type: "text",
      text: `${" ".repeat(left)}${text}${" ".repeat(right)}`,
      preset,
    };
  };

  const lines: ReceiptContentLine[] = [];

  const pushResponsiveColumns = (
    left: string,
    right: string,
    preset?: "normal" | "medium" | "large"
  ) => {
    const safeLeft = (left ?? "").trim();
    const safeRight = (right ?? "").trim();
    const availableWidth = Math.max(receiptWidth - receiptIndent, 8);
    const estimatedLength = safeLeft.length + safeRight.length + 2;

    if (estimatedLength > availableWidth) {
      if (safeLeft) {
        lines.push({
          type: "text",
          text: safeLeft,
          preset,
        });
      }
      if (safeRight) {
        lines.push({
          type: "columns",
          left: "",
          right: safeRight,
          indent: receiptIndent,
          width: receiptWidth,
          preset,
        });
      }
      return;
    }

    lines.push({
      type: "columns",
      left: safeLeft,
      right: safeRight,
      indent: receiptIndent,
      width: receiptWidth,
      preset,
    });
  };

  const addMetaRow = (
    label: string,
    value?: string | number | null,
    preset?: "normal" | "medium" | "large"
  ) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    const availableWidth = Math.max(receiptWidth - receiptIndent, 8);
    const wrapped = wrapTextToWidth(String(value), availableWidth);
    if (wrapped.length === 0) return;
    const first = wrapped.shift()!;
    pushResponsiveColumns(label, first, preset);
    wrapped.forEach((line) => {
      pushResponsiveColumns("", line, preset);
    });
  };

  if (tenantHeaderLines.length) {
    lines.push(...tenantHeaderLines);
    lines.push({ type: "separator", length: receiptWidth });
  }

  if (title) {
    lines.push(toCenteredLine(title, "medium"));
    lines.push({ type: "separator", length: receiptWidth });
  }

  const metaRows: ReceiptMetaRow[] = [];
  if (orderNumber) {
    metaRows.push({ label: "Sipariş No", value: orderNumber });
  }
  if (createdAtText) {
    metaRows.push({ label: "Tarih", value: createdAtText });
  }
  if (customerName) {
    metaRows.push({ label: "Müşteri", value: customerName });
  }
  metaRows.push({
    label: "Satıcı",
    value: sellerName || "Satıcı",
  });
  if (extraMetaRows.length) {
    metaRows.push(...extraMetaRows);
  }

  if (metaRows.length) {
    lines.push(toCenteredLine("Sipariş Bilgileri", "medium"));
    lines.push({ type: "separator", char: ".", length: receiptWidth });
    metaRows.forEach((row) => addMetaRow(row.label, row.value));
    lines.push({ type: "separator", length: receiptWidth });
  }

  const safeItems = items ?? [];
  if (!safeItems.length) {
    lines.push({ text: itemsEmptyMessage, align: "center" });
  } else {
    safeItems.forEach((item, index) => {
      const qty = item.quantity ?? 0;
      const displayUnitPrice = convertAmount(item.unitPrice ?? 0, item.currency);
      const lineSubtotal =
        item.subtotal ??
        (item.unitPrice ?? 0) * (item.quantity ?? 0);
      const displaySubtotal = convertAmount(lineSubtotal, item.currency);

      if (index > 0) {
        lines.push({ type: "empty", count: 1 });
      }

      lines.push({
        text: item.name || "Ürün",
        align: "left",
        preset: "medium",
      });
      pushResponsiveColumns(
        `${qty} x ${formatDisplayMoney(displayUnitPrice)}`,
        formatDisplayMoney(displaySubtotal)
      );
    });
  }

  lines.push({ type: "separator", length: receiptWidth });
  lines.push(toCenteredLine("Ödeme Özeti", "medium"));
  lines.push({ type: "separator", length: receiptWidth });

  if (hasMeaningfulAmount(subtotal)) {
    pushResponsiveColumns(
      "Ara Toplam",
      formatDisplayMoney(convertSummaryAmount(subtotal)),
      "medium"
    );
  }

  if (hasMeaningfulAmount(totalDiscount)) {
    const discountPercent = hasMeaningfulAmount(subtotal)
      ? formatPercentage((totalDiscount / subtotal) * 100)
      : null;
    const discountLabel = discountPercent
      ? `İndirim (%${discountPercent})`
      : "İndirim";
    pushResponsiveColumns(
      discountLabel,
      `-${formatDisplayMoney(convertSummaryAmount(totalDiscount))}`
    );
  }

  if (hasMeaningfulAmount(totalTax)) {
    const taxBaseAmount = Math.max(subtotal - totalDiscount, 0);
    const taxPercent = hasMeaningfulAmount(taxBaseAmount)
      ? formatPercentage((totalTax / taxBaseAmount) * 100)
      : null;
    const taxLabel = taxPercent ? `KDV (%${taxPercent})` : "KDV";
    pushResponsiveColumns(
      taxLabel,
      formatDisplayMoney(convertSummaryAmount(totalTax))
    );
  }

  const totalDisplay = convertSummaryAmount(total);
  const paidRaw = paid ?? total;
  const resolvedPaid = convertSummaryAmount(paidRaw, paidCurrency);
  const remainingRaw =
    remaining !== undefined && remaining !== null
      ? Math.max(remaining, 0)
      : Math.max(total - paidRaw, 0);
  const resolvedRemaining = convertSummaryAmount(remainingRaw);
  const hasOutstandingDebt = hasMeaningfulAmount(resolvedRemaining);
  const displayPaidAmount = hasOutstandingDebt ? totalDisplay : resolvedPaid;
  pushResponsiveColumns("Ödenen", formatDisplayMoney(displayPaidAmount));

  const resolvedChange =
    changeAmount !== undefined && changeAmount !== null
      ? convertSummaryAmount(changeAmount)
      : Math.max(resolvedPaid - totalDisplay, 0);
  if (hasMeaningfulAmount(resolvedChange)) {
    pushResponsiveColumns("Para Üstü", formatDisplayMoney(resolvedChange));
  }

  lines.push({ type: "separator", char: ".", length: receiptWidth });
  lines.push(toCenteredLine("Genel Toplam", "medium"));
  lines.push({
    text: formatDisplayMoney(totalDisplay),
    preset: "large",
  });

  if (!hasOutstandingDebt && hasMeaningfulAmount(resolvedRemaining)) {
    pushResponsiveColumns("Borç", formatDisplayMoney(resolvedRemaining));
  }

  lines.push({ type: "empty", count: 1 });
  if (thankYouMessage) {
    lines.push(toCenteredLine(thankYouMessage));
  }
  lines.push({ type: "empty", count: 30 });

  return lines;
};

export type BuildSaleReceiptOptions = {
  tenantHeaderLines?: ReceiptContentLine[];
  title?: string;
  orderNumber?: string | null;
  createdAtText?: string | null;
  customerName?: string | null;
  sellerName?: string | null;
  branchName?: string | null;
  extraMetaRows?: ReceiptMetaRow[];
  items: ReceiptItem[];
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  total: number;
  paid?: number;
  remaining?: number;
  paymentLabel?: string | null;
  thankYouMessage?: string | null;
  receiptWidth: number;
  receiptIndent: number;
  currency?: string;
  targetCurrency?: CurrencyCode;
  rates?: Rates;
  paidCurrency?: CurrencyCode;
  summaryAlreadyTarget?: boolean;
};

export const buildSaleReceiptLines = (
  options: BuildSaleReceiptOptions
): ReceiptContentLine[] => {
  const {
    branchName,
    extraMetaRows = [],
    subtotal = 0,
    totalDiscount = 0,
    totalTax = 0,
    total,
    paid,
    remaining,
    title = "Satış Fişi",
    thankYouMessage = "Teşekkür ederiz!",
    currency = "TRY",
    targetCurrency = "TRY",
    rates,
    paidCurrency,
    summaryAlreadyTarget = false,
    ...rest
  } = options;

  return buildStandardReceiptLines({
    ...rest,
    title,
    thankYouMessage,
    extraMetaRows,
    subtotal,
    totalDiscount,
    totalTax,
    total,
    paid: paid ?? total,
    remaining: remaining ?? Math.max(total - (paid ?? total), 0),
    paymentLabel: rest.paymentLabel ?? null,
    currency,
    targetCurrency,
    rates,
    paidCurrency,
    summaryAlreadyTarget,
  });
};
export const wrapTextToWidth = (value: string, width: number): string[] => {
  const safe = (value ?? "").trim();
  if (!safe) return [];
  if (safe.length <= width) return [safe];
  const words = safe.split(/\s+/);
  const result: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (!word) return;
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      result.push(current);
      current = word;
    }
  });
  if (current) {
    result.push(current);
  }
  return result;
};
