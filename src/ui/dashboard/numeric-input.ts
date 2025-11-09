export const sanitizeNumericInput = (value: string) => value.replace(/[^\d.,-]/g, "");

export const parseNumericInput = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/,/g, "").trim();
  if (normalized.length === 0) {
    return null;
  }
  const numeric = Number(normalized);
  return Number.isNaN(numeric) ? null : numeric;
};
