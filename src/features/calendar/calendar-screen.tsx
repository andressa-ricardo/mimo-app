import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/forms/segmented-control';
import { AppText } from '@/components/ui/app-text';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { getTask } from '@/database/repositories/tasks-repository';
import { useCalendarRange } from '@/features/calendar/calendar-data';
import { AppointmentDetailsSheet, type AppointmentRef } from '@/features/calendar/components/appointment-details-sheet';
import { AppointmentSheet, type AppointmentSheetMode } from '@/features/calendar/components/appointment-sheet';
import { MonthGrid, monthGridDays, WeekStrip } from '@/features/calendar/components/calendar-views';
import { DayAgenda } from '@/features/calendar/components/day-agenda';
import { TaskQuickSheet } from '@/features/quick-actions/task-quick-sheet';
import { useNow } from '@/features/quick-actions/use-form-options';
import { toggleTaskCompleted } from '@/features/tasks/create-task';
import { useAppTheme } from '@/theme/theme-provider';
import type { CalendarEvent } from '@/types/calendar';
import type { TaskItem } from '@/types/tasks';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  toDateKey,
  type DateKey,
} from '@/utils/date';

type CalendarView = 'month' | 'week' | 'day';

const viewOptions = [
  { value: 'month', label: 'Mês' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Dia' },
] as const;

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const fullDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function periodLabel(view: CalendarView, selected: DateKey): string {
  if (view === 'month') return capitalize(monthYear.format(parseDateKey(selected)));
  if (view === 'day') return capitalize(fullDay.format(parseDateKey(selected)).replace('.', ''));
  const first = startOfWeek(selected);
  const last = addDaysToDateKey(first, 6);
  return `${dayMonth.format(parseDateKey(first)).replace('.', '')} – ${dayMonth.format(parseDateKey(last)).replace('.', '')} de ${first.slice(0, 4)}`;
}

/** Only the visible range is queried: the month grid, or the week around the selected day. */
function visibleRange(view: CalendarView, selected: DateKey): { start: DateKey; end: DateKey } {
  if (view === 'month') {
    const days = monthGridDays(startOfMonth(selected));
    return { start: days[0], end: days[days.length - 1] };
  }
  const first = startOfWeek(selected);
  return { start: first, end: addDaysToDateKey(first, 6) };
}

export function CalendarScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const today = toDateKey(new Date(now));
  const [view, setView] = useState<CalendarView>('month');
  const [selected, setSelected] = useState<DateKey>(() => toDateKey(new Date()));
  const [sheet, setSheet] = useState<AppointmentSheetMode | null>(null);
  const [details, setDetails] = useState<AppointmentRef | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const togglingIds = useRef(new Set<string>());

  const { start, end } = visibleRange(view, selected);
  const { ready, byDay } = useCalendarRange(start, end, { colors, isDark });

  const dots = useMemo(() => {
    const result = new Map<DateKey, string[]>();
    for (const [date, events] of byDay) {
      result.set(date, [...new Set(events.filter((event) => !event.done).map((event) => event.color))]);
    }
    return result;
  }, [byDay]);
  const dotsFor = useCallback((date: DateKey) => dots.get(date) ?? [], [dots]);

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const hideToast = useCallback(() => setToast(null), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeDetails = useCallback(() => setDetails(null), []);
  const closeTask = useCallback(() => setEditingTask(null), []);
  const handleSaved = useCallback(
    (text: string) => {
      setSheet(null);
      setEditingTask(null);
      setDetails(null);
      showToast(text);
    },
    [showToast],
  );

  const shift = (direction: 1 | -1) => {
    setSelected((current) =>
      view === 'month'
        ? addMonthsToDateKey(current, direction)
        : addDaysToDateKey(current, view === 'week' ? direction * 7 : direction),
    );
  };

  const openEvent = async (event: CalendarEvent) => {
    const ref = event.ref;
    if (ref.kind === 'appointment') setDetails({ id: ref.id, occurrenceDate: ref.occurrenceDate });
    else if (ref.kind === 'goal') router.push({ pathname: '/goals/[id]', params: { id: ref.id } }, { withAnchor: true });
    else if (ref.kind === 'finance') router.push('/finances');
    else {
      try {
        const task = await getTask(ref.id);
        if (task) setEditingTask(task);
      } catch (error: unknown) {
        console.error('Falha ao abrir tarefa.', error);
        showToast('Não foi possível abrir a tarefa.');
      }
    }
  };

  const toggleTask = async (event: CalendarEvent) => {
    if (event.ref.kind !== 'task' || togglingIds.current.has(event.ref.id)) return;
    const id = event.ref.id;
    togglingIds.current.add(id);
    try {
      await toggleTaskCompleted(id, !event.done);
    } catch (error: unknown) {
      console.error('Falha ao concluir tarefa.', error);
      showToast('Não foi possível atualizar a tarefa.');
    } finally {
      togglingIds.current.delete(id);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>
        <AppText style={styles.title} variant="section">
          Calendário
        </AppText>
        <Pressable
          accessibilityLabel="Ir para hoje"
          accessibilityRole="button"
          disabled={selected === today}
          onPress={() => setSelected(today)}
          style={({ pressed }) => [
            styles.todayButton,
            { borderColor: colors.border, backgroundColor: colors.surface },
            selected === today && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <AppText color="accent" variant="label">
            Hoje
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.periodRow}>
          <Pressable
            accessibilityLabel={view === 'month' ? 'Mês anterior' : view === 'week' ? 'Semana anterior' : 'Dia anterior'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => shift(-1)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="chevron-back" size={18} />
          </Pressable>
          <AppText accessibilityLiveRegion="polite" style={styles.periodLabel} variant="label">
            {periodLabel(view, selected)}
          </AppText>
          <Pressable
            accessibilityLabel={view === 'month' ? 'Próximo mês' : view === 'week' ? 'Próxima semana' : 'Próximo dia'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => shift(1)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="chevron-forward" size={18} />
          </Pressable>
        </View>

        <SegmentedControl accessibilityLabel="Visualização" onChange={setView} options={viewOptions} value={view} />

        {view === 'month' ? (
          <MonthGrid dotsFor={dotsFor} monthStart={startOfMonth(selected)} onSelect={setSelected} selected={selected} today={today} />
        ) : view === 'week' ? (
          <WeekStrip dotsFor={dotsFor} onSelect={setSelected} selected={selected} today={today} />
        ) : null}

        {ready ? (
          <DayAgenda
            date={selected}
            events={byDay.get(selected) ?? []}
            onAdd={() => setSheet({ kind: 'create', date: selected })}
            onPressEvent={(event) => void openEvent(event)}
            onToggleTask={(event) => void toggleTask(event)}
            today={today}
          />
        ) : (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        )}
      </ScrollView>

      <Pressable
        accessibilityLabel="Novo compromisso"
        accessibilityRole="button"
        onPress={() => setSheet({ kind: 'create', date: selected })}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accent, bottom: insets.bottom + 20 },
          pressed && styles.pressed,
        ]}>
        <Ionicons color={colors.onAccent} name="add" size={26} />
      </Pressable>

      <Toast message={toast} onHide={hideToast} />
      <AppointmentSheet mode={sheet} onClose={closeSheet} onSaved={handleSaved} />
      <AppointmentDetailsSheet
        onClose={closeDetails}
        onDeleted={handleSaved}
        onEdit={(appointment, occurrenceDate) => {
          setDetails(null);
          setSheet({ kind: 'edit', appointment, occurrenceDate });
        }}
        reference={details}
      />
      <TaskQuickSheet onClose={closeTask} onSaved={handleSaved} task={editingTask} visible={editingTask !== null} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 560,
    paddingHorizontal: 16,
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 28,
    elevation: 4,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    width: 56,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  loading: {
    marginTop: 24,
  },
  periodLabel: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  periodRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  pressed: {
    opacity: 0.6,
  },
  screen: {
    flex: 1,
  },
  title: {
    flex: 1,
    fontSize: 17,
  },
  todayButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 14,
  },
});
