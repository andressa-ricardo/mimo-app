import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';
import type { CalendarEvent } from '@/types/calendar';
import { parseDateKey, type DateKey } from '@/utils/date';

const headingFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function formatAgendaHeading(date: DateKey): string {
  const text = headingFormatter.format(parseDateKey(date));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const sourceLabels: Record<CalendarEvent['source'], string> = {
  appointment: 'Compromisso',
  task: 'Tarefa',
  finance: 'Finanças',
  goal: 'Meta',
};

type DayAgendaProps = {
  date: DateKey;
  events: CalendarEvent[];
  onAdd: () => void;
  onPressEvent: (event: CalendarEvent) => void;
  onToggleTask: (event: CalendarEvent) => void;
  today: DateKey;
};

function TaskCheck({ event, onToggle }: { event: CalendarEvent; onToggle: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={event.done ? 'Marcar como não concluída' : 'Concluir tarefa'}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: event.done }}
      hitSlop={10}
      onPress={onToggle}
      style={[
        styles.check,
        event.done ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.textSecondary },
      ]}>
      {event.done ? <Ionicons color={colors.onAccent} name="checkmark" size={11} /> : null}
    </Pressable>
  );
}

function EventCard({
  event,
  onPress,
  onToggleTask,
}: {
  event: CalendarEvent;
  onPress: () => void;
  onToggleTask: () => void;
}) {
  const { colors } = useAppTheme();
  const timeRange =
    event.startTime && event.endTime
      ? `${event.startTime} – ${event.endTime}`
      : event.startTime ?? (event.endTime ? `até ${event.endTime}` : null);

  return (
    <Pressable
      accessibilityHint={event.source === 'finance' ? 'Abre Finanças' : 'Abre os detalhes'}
      accessibilityLabel={[sourceLabels[event.source], event.title, timeRange, event.subtitle].filter(Boolean).join(', ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.colorBar, { backgroundColor: event.color }]} />
      {event.source === 'task' ? <TaskCheck event={event} onToggle={onToggleTask} /> : null}
      <View style={styles.cardBody}>
        <AppText
          color={event.done ? 'secondary' : 'primary'}
          numberOfLines={1}
          style={event.done && event.source === 'task' ? styles.done : undefined}>
          {event.title}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {[timeRange, event.subtitle].filter(Boolean).join(' · ') || sourceLabels[event.source]}
        </AppText>
      </View>
      {event.hasReminder ? (
        <Ionicons accessibilityLabel="Com lembrete" color={colors.textSecondary} name="notifications-outline" size={14} />
      ) : null}
      <Ionicons color={event.color} name={event.icon as keyof typeof Ionicons.glyphMap} size={16} />
    </Pressable>
  );
}

/** Daily agenda shared by the month, week and day views: all-day items, then a timeline. */
export function DayAgenda({ date, events, onAdd, onPressEvent, onToggleTask, today }: DayAgendaProps) {
  const { colors } = useAppTheme();
  const allDay = events.filter((event) => event.allDay);
  const timed = events.filter((event) => !event.allDay);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <AppText accessibilityRole="header" style={styles.flex} variant="section">
          {formatAgendaHeading(date)}
        </AppText>
        {date === today ? (
          <View style={[styles.todayPill, { backgroundColor: colors.accentSoft }]}>
            <AppText color="accent" variant="caption">
              Hoje
            </AppText>
          </View>
        ) : null}
      </View>

      {events.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons color={colors.accent} name="sunny-outline" size={22} />
          <View style={styles.flex}>
            <AppText>Nada planejado para este dia.</AppText>
            <AppText color="secondary" variant="caption">
              Que tal adicionar um compromisso?
            </AppText>
          </View>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onAdd}>
            <AppText color="accent" variant="label">
              + Novo
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {allDay.length > 0 ? (
        <View style={styles.group}>
          <AppText color="secondary" variant="caption">
            Dia todo
          </AppText>
          {allDay.map((event) => (
            <EventCard
              event={event}
              key={event.key}
              onPress={() => onPressEvent(event)}
              onToggleTask={() => onToggleTask(event)}
            />
          ))}
        </View>
      ) : null}

      {timed.length > 0 ? (
        <View style={styles.group}>
          {allDay.length > 0 ? (
            <AppText color="secondary" variant="caption">
              Horários
            </AppText>
          ) : null}
          {timed.map((event, index) => (
            <View key={event.key} style={styles.timelineRow}>
              <View style={styles.timeColumn}>
                <AppText style={styles.time} variant="caption">
                  {event.startTime ?? event.endTime}
                </AppText>
              </View>
              <View style={styles.rail}>
                <View style={[styles.railDot, { backgroundColor: event.color }]} />
                {index < timed.length - 1 ? <View style={[styles.railLine, { backgroundColor: colors.border }]} /> : null}
              </View>
              <View style={styles.flex}>
                <EventCard event={event} onPress={() => onPressEvent(event)} onToggleTask={() => onToggleTask(event)} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    overflow: 'hidden',
    paddingRight: 12,
    paddingVertical: 8,
  },
  cardBody: {
    flex: 1,
    gap: 1,
  },
  check: {
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  colorBar: {
    alignSelf: 'stretch',
    borderRadius: 2,
    marginVertical: -8,
    width: 4,
  },
  container: {
    gap: 12,
  },
  done: {
    textDecorationLine: 'line-through',
  },
  empty: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  flex: {
    flex: 1,
  },
  group: {
    gap: 8,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pressed: {
    opacity: 0.75,
  },
  rail: {
    alignItems: 'center',
    paddingTop: 22,
    width: 14,
  },
  railDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  railLine: {
    flex: 1,
    marginBottom: -30,
    marginTop: 4,
    width: StyleSheet.hairlineWidth * 2,
  },
  time: {
    fontFamily: 'Inter_600SemiBold',
  },
  timeColumn: {
    paddingTop: 18,
    width: 44,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 6,
  },
  todayPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
