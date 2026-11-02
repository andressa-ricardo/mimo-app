import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/forms/segmented-control';
import { MoreModulesMenu } from '@/components/navigation/more-modules-menu';
import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SwipeView } from '@/components/ui/swipe-view';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { confirmEntry } from '@/database/repositories/finance-repository';
import { capitalize, formatShortDate } from '@/features/finance/components/finance-ui';
import { monthRangeOf } from '@/features/finance/month-data';
import { BudgetTab } from '@/features/finance/tabs/budget-tab';
import { CardsTab } from '@/features/finance/tabs/cards-tab';
import { HistoryTab } from '@/features/finance/tabs/history-tab';
import { SummaryTab } from '@/features/finance/tabs/summary-tab';
import { useFinanceMonth } from '@/features/finance/use-finance-month';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import { TransactionQuickSheet } from '@/features/quick-actions/transaction-quick-sheet';
import type { MonthEntry, TransactionType } from '@/types/finance';
import { addMonthsToDateKey, parseDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

type FinanceTab = 'summary' | 'history' | 'budget' | 'cards';

const tabOptions = [
  { value: 'summary', label: 'Resumo' },
  { value: 'history', label: 'Histórico' },
  { value: 'budget', label: 'Orçamento' },
  { value: 'cards', label: 'Cartões' },
] as const;

const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export function FinanceScreen() {
  const { colors } = useAppTheme();
  const [monthStart, setMonthStart] = useState(() => monthRangeOf(new Date()).start);
  const [tab, setTab] = useState<FinanceTab>('summary');
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<MonthEntry | null>(null);
  const confirmingRef = useRef(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [newTransaction, setNewTransaction] = useState<TransactionType | null>(null);
  const month = monthRangeOf(parseDateKey(monthStart));
  const state = useFinanceMonth(month);

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const hideToast = useCallback(() => setToast(null), []);
  const closeNewTransaction = useCallback(() => setNewTransaction(null), []);
  const handleTransactionSaved = useCallback(
    (text: string) => {
      setNewTransaction(null);
      showToast(text);
    },
    [showToast],
  );

  const showNextMonth = useCallback(() => setMonthStart((current) => addMonthsToDateKey(current, 1)), []);
  const showPreviousMonth = useCallback(() => setMonthStart((current) => addMonthsToDateKey(current, -1)), []);

  const confirm = async (entry: MonthEntry) => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirmingKey(entry.key);
    try {
      await confirmEntry(entry);
      setPendingConfirm(null);
      notifyDataChanged('finance');
      showToast(`${entry.type === 'income' ? 'Receita' : 'Despesa'} confirmada.`);
    } catch (error: unknown) {
      console.error('Falha ao confirmar lançamento.', error);
      setPendingConfirm(null);
      showToast('Não foi possível confirmar. Tente novamente.');
    } finally {
      confirmingRef.current = false;
      setConfirmingKey(null);
    }
  };

  const data = state.data;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText style={styles.flex} variant="title">
            Finanças
          </AppText>
          <MoreModulesMenu />
        </View>

        <View style={[styles.monthNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityLabel="Mês anterior"
            accessibilityRole="button"
            hitSlop={8}
            onPress={showPreviousMonth}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="chevron-back" size={18} />
          </Pressable>
          <AppText accessibilityLiveRegion="polite" variant="label" style={styles.monthLabel}>
            {capitalize(monthLabel.format(parseDateKey(monthStart)))}
          </AppText>
          <Pressable
            accessibilityLabel="Próximo mês"
            accessibilityRole="button"
            hitSlop={8}
            onPress={showNextMonth}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="chevron-forward" size={18} />
          </Pressable>
        </View>

        <View style={styles.addRow}>
          {(['expense', 'income'] as const).map((type) => (
            <Pressable
              accessibilityLabel={type === 'income' ? 'Nova receita' : 'Nova despesa'}
              accessibilityRole="button"
              key={type}
              onPress={() => setNewTransaction(type)}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons
                color={type === 'income' ? colors.income : colors.expense}
                name={type === 'income' ? 'arrow-up' : 'arrow-down'}
                size={15}
              />
              <AppText variant="label">{type === 'income' ? 'Receita' : 'Despesa'}</AppText>
            </Pressable>
          ))}
        </View>

        <SegmentedControl accessibilityLabel="Seções de Finanças" onChange={setTab} options={tabOptions} value={tab} />

        {/* Swiping the content moves to the next/previous month. */}
        <SwipeView onSwipeLeft={showNextMonth} onSwipeRight={showPreviousMonth}>
          {data === null ? (
            state.status === 'error' ? (
              <AppText color="secondary" style={styles.message}>
                Não foi possível carregar suas finanças.
              </AppText>
            ) : (
              <ActivityIndicator color={colors.accent} style={styles.message} />
            )
          ) : tab === 'summary' ? (
            <SummaryTab
              confirmingKey={confirmingKey}
              data={data}
              monthKey={month.key}
              onConfirm={setPendingConfirm}
              onSelectTrend={(point) => setMonthStart(point.start)}
            />
          ) : tab === 'history' ? (
            <HistoryTab entries={data.entries} paymentMethods={data.paymentMethods} />
          ) : tab === 'budget' ? (
            <BudgetTab data={data} onFeedback={showToast} />
          ) : (
            <CardsTab data={data} onFeedback={showToast} />
          )}
        </SwipeView>
      </ScrollView>

      <Toast message={toast} onHide={hideToast} />

      <TransactionQuickSheet
        initialType={newTransaction ?? 'expense'}
        onClose={closeNewTransaction}
        onSaved={handleTransactionSaved}
        visible={newTransaction !== null}
      />

      {/* Nothing is saved until the user confirms; cancelling keeps the button. */}
      <ConfirmDialog
        cancelLabel="Agora não"
        confirmLabel="Confirmar"
        loading={confirmingKey !== null}
        message={
          pendingConfirm
            ? `${pendingConfirm.description} · ${formatCurrency(pendingConfirm.amountCents)} · ${formatShortDate(
                pendingConfirm.dueDate,
              )}. Ao confirmar, o valor passa a contar ${
                pendingConfirm.type === 'income' ? 'nas receitas' : 'nas despesas'
              } do mês.`
            : ''
        }
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (pendingConfirm) void confirm(pendingConfirm);
        }}
        title={pendingConfirm?.type === 'income' ? 'Confirmar recebimento?' : 'Confirmar pagamento?'}
        visible={pendingConfirm !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 560,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 8,
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  message: {
    marginTop: 32,
    textAlign: 'center',
  },
  monthButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  monthLabel: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
  },
  monthNav: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.6,
  },
  screen: {
    flex: 1,
  },
});
