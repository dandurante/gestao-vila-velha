/**
 * Currency input helpers — Brazilian format (1.234.567,89).
 * Stores values as numbers (reais), displays as formatted strings.
 */

/** Strip everything except digits, then parse as cents. */
export function parseDigitsToNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

/** Format a number to "1.234.567,89". */
export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return "0,00";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format with R$ prefix. */
export function formatBRLCurrency(value: number): string {
  return `R$ ${formatBRL(value)}`;
}

/** Convert a free text input (digits only) to its formatted display. */
export function maskCurrencyInput(raw: string): string {
  return formatBRL(parseDigitsToNumber(raw));
}
