// All monetary values are integer cents. Nothing in this file uses
// floating-point division on amounts.

/** 11 digits: R$ 999.999.999,99 — far below Number.MAX_SAFE_INTEGER. */
export const MAX_AMOUNT_DIGITS = 11;

const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Turns the digits typed in a currency mask into cents ("1234" → 1234 = R$ 12,34). */
export function centsFromDigits(text: string): number | null {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_AMOUNT_DIGITS);
  return digits ? Number(digits) : null;
}

/** Formats cents without the currency symbol: 123456 → "1.234,56". */
export function formatCentsAmount(cents: number): string {
  const absolute = Math.abs(cents);
  const fraction = absolute % 100;
  const integer = (absolute - fraction) / 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}${integerFormatter.format(integer)},${String(fraction).padStart(2, '0')}`;
}

/**
 * Splits a total into `count` integer installments that add up exactly to the
 * total. The remainder cents go to the first installments.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new Error('O valor total deve ser um inteiro positivo em centavos.');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('O número de parcelas deve ser um inteiro positivo.');
  }
  if (count > totalCents) {
    throw new Error('O valor é pequeno demais para esse número de parcelas.');
  }

  const remainder = totalCents % count;
  const base = (totalCents - remainder) / count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Whole-number percentage without floating-point money math (rounds half up). */
export function percentOf(partCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.floor((partCents * 100 + Math.floor(totalCents / 2)) / totalCents);
}
