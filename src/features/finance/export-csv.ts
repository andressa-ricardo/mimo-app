import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import type { MonthEntry } from '@/types/finance';
import { formatDateKey } from '@/utils/date';

const exportDirectory = new Directory(Paths.cache, 'mimo', 'exports');

/** Error whose message can be shown to the user as-is. */
export class ExportError extends Error {}

/** "-1234,56" — no thousands separator, so spreadsheets read it as a number. */
function csvAmount(cents: number): string {
  const absolute = Math.abs(cents);
  const fraction = absolute % 100;
  return `${cents < 0 ? '-' : ''}${(absolute - fraction) / 100},${String(fraction).padStart(2, '0')}`;
}

function csvField(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function detail(entry: MonthEntry): string {
  if (entry.installmentCount > 1) return `Parcela ${entry.sequence}/${entry.installmentCount}`;
  return entry.recurring ? 'Recorrente' : '';
}

/**
 * Month entries as CSV for pt-BR spreadsheets: ";" separator, decimal comma,
 * UTF-8 with BOM (so Excel shows accents), expenses as negative values.
 */
export function buildMonthCsv(entries: MonthEntry[]): string {
  const header = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Pagamento', 'Valor (R$)', 'Status', 'Detalhe'];
  const rows = entries.map((entry) => [
    formatDateKey(entry.dueDate),
    entry.description,
    entry.type === 'income' ? 'Receita' : 'Despesa',
    entry.categoryName ?? '',
    entry.paymentMethodName ?? '',
    csvAmount(entry.type === 'income' ? entry.amountCents : -entry.amountCents),
    entry.status === 'planned' ? 'Planejado' : 'Confirmado',
    detail(entry),
  ]);
  return `﻿${[header, ...rows].map((row) => row.map(csvField).join(';')).join('\r\n')}\r\n`;
}

/** Writes the month's CSV to the cache and opens the share sheet. */
export async function exportMonthCsv(entries: MonthEntry[], monthKey: string): Promise<void> {
  if (entries.length === 0) throw new ExportError('Não há lançamentos neste mês para exportar.');
  if (!(await isAvailableAsync())) throw new ExportError('Compartilhamento indisponível neste dispositivo.');

  // Only the latest export is kept in the cache.
  if (exportDirectory.exists) exportDirectory.delete();
  exportDirectory.create({ intermediates: true, idempotent: true });
  const file = new File(exportDirectory, `mimo-financas-${monthKey}.csv`);
  file.create({ overwrite: true });
  await file.write(buildMonthCsv(entries));

  await shareAsync(file.uri, {
    dialogTitle: 'Exportar finanças do mês',
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
