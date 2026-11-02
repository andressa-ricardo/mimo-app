import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/ui/app-text';
import type { CategoryTotal } from '@/features/finance/month-data';
import { categoryColor } from '@/theme/category-colors';
import { useAppTheme } from '@/theme/theme-provider';
import { formatCurrency } from '@/utils/format';
import { percentOf } from '@/utils/money';

const SIZE = 168;
const OUTER_RADIUS = SIZE / 2;
const INNER_RADIUS = OUTER_RADIUS - 28;
/** Categories beyond this fold into "Outras" so slices stay readable. */
const MAX_SLICES = 5;

type Slice = { key: string; name: string; amountCents: number; color: string };

function point(radius: number, angle: number): string {
  return `${OUTER_RADIUS + radius * Math.cos(angle)} ${OUTER_RADIUS + radius * Math.sin(angle)}`;
}

/** Ring segment between two angles (radians, 0 = 3 o'clock). */
function ringSegment(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(OUTER_RADIUS, start)}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${large} 1 ${point(OUTER_RADIUS, end)}`,
    `L ${point(INNER_RADIUS, end)}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${large} 0 ${point(INNER_RADIUS, start)}`,
    'Z',
  ].join(' ');
}

function buildSlices(categories: CategoryTotal[], isDark: boolean, mutedColor: string): Slice[] {
  const sorted = [...categories].sort((a, b) => b.amountCents - a.amountCents);
  const main = sorted.slice(0, MAX_SLICES).map((category) => ({
    key: category.categoryId ?? 'none',
    name: category.name,
    amountCents: category.amountCents,
    color: category.categoryId ? categoryColor(category.categoryId, isDark) : mutedColor,
  }));
  const restCents = sorted.slice(MAX_SLICES).reduce((total, category) => total + category.amountCents, 0);
  return restCents > 0 ? [...main, { key: 'other', name: 'Outras', amountCents: restCents, color: mutedColor }] : main;
}

/** Start/end angle of each slice, clockwise from 12 o'clock (geometry only). */
function sliceAngles(slices: Slice[], totalCents: number): { slice: Slice; start: number; end: number }[] {
  const result: { slice: Slice; start: number; end: number }[] = [];
  let start = -Math.PI / 2;
  for (const slice of slices) {
    const end = start + (slice.amountCents / totalCents) * Math.PI * 2;
    result.push({ slice, start, end });
    start = end;
  }
  return result;
}

/**
 * Donut of the month's confirmed spending by category. A legend lists every
 * slice with its value and share, so identity never depends on color alone.
 */
export function CategoryPieChart({ categories }: { categories: CategoryTotal[] }) {
  const { colors, isDark } = useAppTheme();
  const slices = buildSlices(categories, isDark, colors.chartMuted);
  const totalCents = slices.reduce((total, slice) => total + slice.amountCents, 0);

  const paths = sliceAngles(slices, totalCents);

  const summary = slices.map((slice) => `${slice.name} ${percentOf(slice.amountCents, totalCents)}%`).join(', ');

  return (
    <View style={styles.container}>
      <View accessibilityLabel={`Gráfico de pizza: ${summary}`} accessible style={styles.chart}>
        <Svg height={SIZE} width={SIZE}>
          {paths.length === 1 ? (
            <Circle
              cx={OUTER_RADIUS}
              cy={OUTER_RADIUS}
              fill="none"
              r={(OUTER_RADIUS + INNER_RADIUS) / 2}
              stroke={paths[0].slice.color}
              strokeWidth={OUTER_RADIUS - INNER_RADIUS}
            />
          ) : (
            paths.map(({ slice, start, end }) => (
              // The surface-colored stroke is the 2px gap between slices.
              <Path d={ringSegment(start, end)} fill={slice.color} key={slice.key} stroke={colors.surface} strokeWidth={2} />
            ))
          )}
        </Svg>
        <View pointerEvents="none" style={styles.center}>
          <AppText color="secondary" variant="caption">
            Total
          </AppText>
          <AppText style={styles.total}>{formatCurrency(totalCents)}</AppText>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <AppText numberOfLines={1} style={styles.flex}>
              {slice.name}
            </AppText>
            <AppText color="secondary" style={styles.percent} variant="caption">
              {percentOf(slice.amountCents, totalCents)}%
            </AppText>
            <AppText variant="label">{formatCurrency(slice.amountCents)}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  chart: {
    alignSelf: 'center',
    height: SIZE,
    width: SIZE,
  },
  container: {
    gap: 16,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  flex: {
    flex: 1,
  },
  legend: {
    gap: 10,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  percent: {
    minWidth: 34,
    textAlign: 'right',
  },
  total: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
});
