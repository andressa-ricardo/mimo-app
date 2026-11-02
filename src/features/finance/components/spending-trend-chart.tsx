import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import type { TrendPoint } from '@/features/finance/month-data';
import { useAppTheme } from '@/theme/theme-provider';
import { parseDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

const PLOT_HEIGHT = 112;
const LABEL_SPACE = 20;
const BAR_WIDTH = 22;
const MIN_VISIBLE_BAR = 3;

const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const longMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const wholeReais = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** "R$ 3.964" — whole reais (integer math) so cap labels fit the column. */
function formatCapLabel(cents: number): string {
  return `R$ ${wholeReais.format((cents - (cents % 100)) / 100)}`;
}

type SpendingTrendChartProps = {
  onSelect: (point: TrendPoint) => void;
  points: TrendPoint[];
  selectedKey: string;
};

/**
 * Single-series column chart of confirmed expenses (emphasis form): the viewed
 * month in the accent, the others in a recessive gray. Only the highlighted
 * column carries a value label; tapping a column switches to that month.
 */
export function SpendingTrendChart({ onSelect, points, selectedKey }: SpendingTrendChartProps) {
  const { colors } = useAppTheme();
  const maxCents = Math.max(0, ...points.map((point) => point.expenseCents));
  const hasData = maxCents > 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="section" style={styles.title}>
        Evolução dos gastos
      </AppText>
      <AppText color="secondary" variant="caption">
        Despesas confirmadas nos últimos {points.length} meses · toque para ver o mês
      </AppText>

      <View style={styles.plot}>
        {points.map((point) => {
          const selected = point.key === selectedKey;
          const height = hasData
            ? Math.max(point.expenseCents > 0 ? MIN_VISIBLE_BAR : 0, Math.round((point.expenseCents / maxCents) * PLOT_HEIGHT))
            : 0;
          const monthDate = parseDateKey(point.start);

          return (
            <Pressable
              accessibilityHint="Mostra este mês"
              accessibilityLabel={`${longMonth.format(monthDate)}: ${formatCurrency(point.expenseCents)}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={point.key}
              onPress={() => onSelect(point)}
              style={styles.slot}>
              {selected && hasData ? (
                <AppText numberOfLines={1} style={styles.capLabel} variant="caption">
                  {formatCapLabel(point.expenseCents)}
                </AppText>
              ) : null}
              <View
                style={[
                  styles.bar,
                  { backgroundColor: selected ? colors.accent : colors.chartMuted, height },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.baseline, { backgroundColor: colors.border }]} />
      <View style={styles.axis}>
        {points.map((point) => {
          const selected = point.key === selectedKey;
          return (
            <AppText
              color={selected ? 'primary' : 'secondary'}
              key={point.key}
              style={[styles.axisLabel, selected && styles.axisLabelSelected]}
              variant="caption">
              {shortMonth.format(parseDateKey(point.start)).replace('.', '')}
            </AppText>
          );
        })}
      </View>

      {hasData ? null : (
        <AppText color="secondary" style={styles.emptyNote} variant="caption">
          Nenhuma despesa confirmada nesse período.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: 'row',
    marginTop: 6,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
  },
  axisLabelSelected: {
    fontFamily: 'Inter_600SemiBold',
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    width: BAR_WIDTH,
  },
  baseline: {
    height: StyleSheet.hairlineWidth,
  },
  capLabel: {
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
    minWidth: 80,
    textAlign: 'center',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  emptyNote: {
    marginTop: 10,
    textAlign: 'center',
  },
  plot: {
    flexDirection: 'row',
    height: PLOT_HEIGHT + LABEL_SPACE,
    marginTop: 14,
  },
  slot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  title: {
    marginBottom: 2,
  },
});
