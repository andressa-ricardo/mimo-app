import { formatCentsAmount } from '@/utils/money';

export function formatCurrency(cents: number): string {
  const formatted = `R$ ${formatCentsAmount(Math.abs(cents))}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

export function formatHomeDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
