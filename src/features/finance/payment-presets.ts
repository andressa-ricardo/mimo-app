import type Ionicons from '@expo/vector-icons/Ionicons';

import type { PaymentMethod, PaymentMethodKind } from '@/types/categories';

export type PaymentPreset = {
  key: string;
  name: string;
  kind: PaymentMethodKind;
  institution: string | null;
};

const banks = [
  'Nubank',
  'Inter',
  'Itaú',
  'Bradesco',
  'Santander',
  'Banco do Brasil',
  'Caixa',
  'C6 Bank',
  'PicPay',
  'Mercado Pago',
];

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

/**
 * Suggestions offered in the payment selector. A preset only becomes a
 * payment_methods row when the user picks it, so the Cartões tab lists just
 * the methods actually in use.
 */
export const paymentPresets: readonly PaymentPreset[] = [
  { key: 'pix', name: 'Pix', kind: 'pix', institution: null },
  { key: 'cash', name: 'Dinheiro', kind: 'cash', institution: null },
  ...banks.flatMap((bank): PaymentPreset[] => [
    { key: `credit-${slug(bank)}`, name: `Crédito ${bank}`, kind: 'credit', institution: bank },
    { key: `debit-${slug(bank)}`, name: `Débito ${bank}`, kind: 'debit', institution: bank },
  ]),
  { key: 'meal-voucher', name: 'Vale-refeição', kind: 'other', institution: null },
  { key: 'boleto', name: 'Boleto', kind: 'other', institution: null },
];

export const PRESET_VALUE_PREFIX = 'preset:';

export function findPreset(value: string): PaymentPreset | undefined {
  if (!value.startsWith(PRESET_VALUE_PREFIX)) return undefined;
  const key = value.slice(PRESET_VALUE_PREFIX.length);
  return paymentPresets.find((preset) => preset.key === key);
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'accent' }) === 0;
}

/** Presets the user has not registered yet. */
export function unusedPresets(methods: PaymentMethod[]): PaymentPreset[] {
  return paymentPresets.filter((preset) => !methods.some((method) => sameName(method.name, preset.name)));
}

export const paymentKindLabels: Record<PaymentMethodKind, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
  cash: 'Dinheiro',
  other: 'Outro',
};

export const paymentKindIcons: Record<PaymentMethodKind, keyof typeof Ionicons.glyphMap> = {
  credit: 'card-outline',
  debit: 'card-outline',
  pix: 'qr-code-outline',
  cash: 'cash-outline',
  other: 'wallet-outline',
};

/** Guesses the type from a typed name ("Crédito Inter" → credit). */
export function inferPaymentKind(name: string): PaymentMethodKind {
  const normalized = slug(name);
  if (normalized.includes('credito')) return 'credit';
  if (normalized.includes('debito')) return 'debit';
  if (normalized.includes('pix')) return 'pix';
  if (normalized.includes('dinheiro')) return 'cash';
  return 'other';
}

export function describePaymentMethod(method: PaymentMethod): string {
  const kind = paymentKindLabels[method.kind];
  if (method.kind === 'credit' && method.dueDay !== null) return `${kind} · vence dia ${method.dueDay}`;
  return kind;
}
