import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';
import { addDaysToDateKey, startOfWeek, type DateKey } from '@/utils/date';

export const weekdayInitials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const weekdayShort = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MAX_DOTS = 3;

/** The 42 days (6 weeks, from Sunday) shown for the month that starts at `monthStart`. */
export function monthGridDays(monthStart: DateKey): DateKey[] {
  const first = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, index) => addDaysToDateKey(first, index));
}

type DayCellProps = {
  date: DateKey;
  dots: string[];
  inMonth: boolean;
  onSelect: (date: DateKey) => void;
  selected: boolean;
  today: boolean;
  weekdayLabel?: string;
};

const DayCell = memo(function DayCell({ date, dots, inMonth, onSelect, selected, today, weekdayLabel }: DayCellProps) {
  const { colors } = useAppTheme();
  const day = Number(date.slice(8));
  const textColor = selected ? colors.onAccent : today ? colors.accent : inMonth ? colors.text : colors.textSecondary;

  return (
    <Pressable
      accessibilityLabel={`${day}${today ? ', hoje' : ''}${dots.length > 0 ? ', com eventos' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(date)}
      style={styles.cell}>
      {weekdayLabel ? (
        <AppText color="secondary" style={styles.weekdayLabel} variant="caption">
          {weekdayLabel}
        </AppText>
      ) : null}
      <View
        style={[
          styles.dayCircle,
          selected && { backgroundColor: colors.accent },
          !selected && today && { borderColor: colors.accent, borderWidth: 1.5 },
        ]}>
        <AppText
          style={[styles.dayText, { color: textColor, opacity: inMonth || selected ? 1 : 0.45 }, (today || selected) && styles.bold]}>
          {day}
        </AppText>
      </View>
      <View style={styles.dots}>
        {dots.slice(0, MAX_DOTS).map((color, index) => (
          <View key={`${color}-${index}`} style={[styles.dot, { backgroundColor: color }]} />
        ))}
      </View>
    </Pressable>
  );
});

type GridProps = {
  dotsFor: (date: DateKey) => string[];
  onSelect: (date: DateKey) => void;
  selected: DateKey;
  today: DateKey;
};

export function MonthGrid({ dotsFor, monthStart, onSelect, selected, today }: GridProps & { monthStart: DateKey }) {
  const { colors } = useAppTheme();
  const days = monthGridDays(monthStart);
  const month = monthStart.slice(0, 7);
  // Drop a trailing week that belongs entirely to the next month.
  const visible = days.slice(35).every((date) => date.slice(0, 7) !== month) ? days.slice(0, 35) : days;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        {weekdayInitials.map((label, index) => (
          <AppText color="secondary" key={`${label}-${index}`} style={styles.headerLabel} variant="caption">
            {label}
          </AppText>
        ))}
      </View>
      {Array.from({ length: visible.length / 7 }, (_, week) => (
        <View key={week} style={styles.row}>
          {visible.slice(week * 7, week * 7 + 7).map((date) => (
            <DayCell
              date={date}
              dots={dotsFor(date)}
              inMonth={date.slice(0, 7) === month}
              key={date}
              onSelect={onSelect}
              selected={date === selected}
              today={date === today}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function WeekStrip({ dotsFor, onSelect, selected, today }: GridProps) {
  const { colors } = useAppTheme();
  const first = startOfWeek(selected);
  return (
    <View style={[styles.card, styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {Array.from({ length: 7 }, (_, index) => {
        const date = addDaysToDateKey(first, index);
        return (
          <DayCell
            date={date}
            dots={dotsFor(date)}
            inMonth
            key={date}
            onSelect={onSelect}
            selected={date === selected}
            today={date === today}
            weekdayLabel={weekdayShort[index]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontFamily: 'Inter_600SemiBold',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  cell: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 3,
  },
  dayCircle: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  dayText: {
    fontSize: 14,
  },
  dot: {
    borderRadius: 2.5,
    height: 5,
    width: 5,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 7,
    justifyContent: 'center',
    marginTop: 2,
  },
  headerLabel: {
    flex: 1,
    paddingBottom: 4,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    fontSize: 10,
    marginBottom: 3,
  },
});
