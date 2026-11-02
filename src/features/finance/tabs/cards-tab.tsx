import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card, EmptyNote, ProgressBar, SectionHeader } from '@/features/finance/components/finance-ui';
import { PaymentMethodSheet } from '@/features/finance/components/payment-method-sheet';
import { describePaymentMethod, paymentKindIcons } from '@/features/finance/payment-presets';
import type { FinanceMonthData } from '@/features/finance/use-finance-month';
import { useAppTheme } from '@/theme/theme-provider';
import type { PaymentMethod } from '@/types/categories';
import { formatCurrency } from '@/utils/format';

type SheetState = { open: false } | { open: true; method: PaymentMethod | null };

export function CardsTab({ data, onFeedback }: { data: FinanceMonthData; onFeedback: (message: string) => void }) {
  const { colors } = useAppTheme();
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const spentBy = data.summary.byPaymentMethod;
  // Emphasis: the method with the highest spend this month is highlighted.
  const topMethodId = [...spentBy].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <View style={styles.container}>
      <SectionHeader
        actionLabel="+ Adicionar"
        onAction={() => setSheet({ open: true, method: null })}
        title="Formas de pagamento"
      />

      {data.paymentMethods.length === 0 ? (
        <EmptyNote>Adicione cartões, Pix ou dinheiro para ver quanto saiu de cada um.</EmptyNote>
      ) : (
        data.paymentMethods.map((method) => {
          const highlighted = method.id === topMethodId;
          const textColor = highlighted ? colors.onAccent : colors.text;
          return (
            <Pressable
              accessibilityHint="Editar forma de pagamento"
              accessibilityLabel={`${method.name}, ${formatCurrency(spentBy.get(method.id) ?? 0)} no mês`}
              accessibilityRole="button"
              key={method.id}
              onPress={() => setSheet({ open: true, method })}
              style={({ pressed }) => [
                styles.method,
                highlighted
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons color={textColor} name={paymentKindIcons[method.kind]} size={20} />
              <View style={styles.flex}>
                <AppText numberOfLines={1} style={[styles.methodName, { color: textColor }]}>
                  {method.name}
                </AppText>
                <AppText
                  color="secondary"
                  numberOfLines={1}
                  style={highlighted ? [styles.muted, { color: colors.onAccent }] : undefined}
                  variant="caption">
                  {describePaymentMethod(method)}
                </AppText>
              </View>
              <View style={styles.amountBlock}>
                <AppText
                  color="secondary"
                  style={highlighted ? [styles.muted, { color: colors.onAccent }] : undefined}
                  variant="caption">
                  No mês
                </AppText>
                <AppText style={[styles.amount, { color: textColor }]}>
                  {formatCurrency(spentBy.get(method.id) ?? 0)}
                </AppText>
              </View>
            </Pressable>
          );
        })
      )}

      <Card style={styles.installments}>
        <AppText variant="section" style={styles.installmentsTitle}>
          Parcelamentos ativos
        </AppText>
        {data.installments.length === 0 ? (
          <AppText color="secondary" variant="caption">
            Nenhuma compra parcelada neste mês.
          </AppText>
        ) : (
          data.installments.map((installment) => (
            <View key={installment.transactionId} style={styles.installmentRow}>
              <View style={styles.installmentHeading}>
                <AppText numberOfLines={1} style={styles.flex}>
                  {installment.description} ({installment.current}/{installment.total})
                </AppText>
                <AppText color="secondary" variant="caption">
                  {installment.current}/{installment.total}
                </AppText>
              </View>
              <ProgressBar color={colors.accent} fraction={installment.current / installment.total} />
            </View>
          ))
        )}
      </Card>

      <PaymentMethodSheet
        existing={data.paymentMethods}
        method={sheet.open ? sheet.method : null}
        onClose={() => setSheet({ open: false })}
        onSaved={(message) => {
          setSheet({ open: false });
          onFeedback(message);
        }}
        visible={sheet.open}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  container: {
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  installmentHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  installmentRow: {
    gap: 8,
  },
  installments: {
    gap: 14,
    marginTop: 4,
    padding: 14,
  },
  installmentsTitle: {
    fontSize: 15,
  },
  method: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  methodName: {
    fontFamily: 'Inter_600SemiBold',
  },
  muted: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.8,
  },
});
