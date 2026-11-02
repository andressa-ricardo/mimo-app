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

/** Compact cap label so six columns fit: "R$ 855", "R$ 3,9 mil", "R$ 12 mil" (integer math). */
function formatCapLabel(cents: number): string {
  const reais = (cents - (cents % 100)) / 100;
  if (reais < 1000) return `R$ ${wholeReais.format(reais)}`;
  const tenths = Math.round(reais / 100); // thousands, one decimal
  if (tenths >= 100) return `R$ ${wholeReais.format(Math.round(tenths / 10))} mil`;
  const whole = (tenths - (tenths % 10)) / 10;
  return tenths % 10 === 0 ? `R$ ${whole} mil` : `R$ ${whole},${tenths % 10} mil`;
}

type SpendingTrendChartProps = {
  onSelect: (point: TrendPoint) => void;
  points: TrendPoint[];
  selectedKey: string;
};

/**
 * Single-series column chart of confirmed expenses (emphasis form): the viewed
 * month in the accent, the others in a recessive gray. Every column carries a
 * compact value (the viewed month in bold); tapping a column switches to that month.
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
              {point.expenseCents > 0 ? (
                <AppText
                  color={selected ? 'primary' : 'secondary'}
                  numberOfLines={1}
                  style={[styles.capLabel, selected && styles.capLabelSelected]}
                  variant="caption">
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
    fontSize: 10,
    marginBottom: 4,
    minWidth: 64,
    textAlign: 'center',
  },
  capLabelSelected: {
    fontFamily: 'Inter_600SemiBold',
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
