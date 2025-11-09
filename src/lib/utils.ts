import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

const currencyFormatterSigned = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero"
});

const manFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0
});

const manFormatterSigned = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
  signDisplay: "exceptZero"
});

export function formatCurrencyJPY(
  value: number,
  options?: {
    mode?: "yen" | "man";
    showSign?: boolean;
    fallback?: string;
  }
) {
  if (Number.isNaN(value)) {
    return options?.fallback ?? "--";
  }

  const { mode = "yen", showSign = false } = options ?? {};
  const absoluteValue = mode === "yen" ? value : value / 10_000;

  if (mode === "yen") {
    return (showSign ? currencyFormatterSigned : currencyFormatter).format(absoluteValue);
  }

  const formattedMan = (showSign ? manFormatterSigned : manFormatter).format(absoluteValue);
  return `${formattedMan}\u4e07\u5186`;
}

