import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/forms/segmented-control';
import { MoreModulesMenu } from '@/components/navigation/more-modules-menu';
import { AppText } from '@/components/ui/app-text';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { confirmEntry } from '@/database/repositories/finance-repository';
import { capitalize } from '@/features/finance/components/finance-ui';
import { monthRangeOf } from '@/features/finance/month-data';
import { BudgetTab } from '@/features/finance/tabs/budget-tab';
import { CardsTab } from '@/features/finance/tabs/cards-tab';
import { HistoryTab } from '@/features/finance/tabs/history-tab';
import { SummaryTab } from '@/features/finance/tabs/summary-tab';
import { useFinanceMonth } from '@/features/finance/use-finance-month';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import type { MonthEntry } from '@/types/finance';
import { addMonthsToDateKey, parseDateKey } from '@/utils/date';

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
  const confirmingRef = useRef(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const month = monthRangeOf(parseDateKey(monthStart));
  const state = useFinanceMonth(month);

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const hideToast = useCallback(() => setToast(null), []);

  const shiftMonth = (delta: number) => setMonthStart((current) => addMonthsToDateKey(current, delta));

  const confirm = async (entry: MonthEntry) => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirmingKey(entry.key);
    try {
      await confirmEntry(entry);
      notifyDataChanged('finance');
      showToast(`${entry.type === 'income' ? 'Receita' : 'Despesa'} confirmada.`);
    } catch (error: unknown) {
      console.error('Falha ao confirmar lançamento.', error);
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
            onPress={() => shiftMonth(-1)}
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
            onPress={() => shiftMonth(1)}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="chevron-forward" size={18} />
          </Pressable>
        </View>

        <SegmentedControl accessibilityLabel="Seções de Finanças" onChange={setTab} options={tabOptions} value={tab} />

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
            onConfirm={(entry) => void confirm(entry)}
            onSelectTrend={(point) => setMonthStart(point.start)}
          />
        ) : tab === 'history' ? (
          <HistoryTab entries={data.entries} paymentMethods={data.paymentMethods} />
        ) : tab === 'budget' ? (
          <BudgetTab data={data} onFeedback={showToast} />
        ) : (
          <CardsTab data={data} onFeedback={showToast} />
        )}
      </ScrollView>

      <Toast message={toast} onHide={hideToast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
