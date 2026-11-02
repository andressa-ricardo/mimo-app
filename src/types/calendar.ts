import type { PaletteColorKey } from '@/theme/category-colors';
import type { DateKey, TimeKey } from '@/utils/date';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

/** Minutes before the start; 0 = at the time of the event. */
export type ReminderMinutes = 0 | 5 | 15 | 30 | 60 | 1440;

export type AppointmentCategory = {
  id: string;
  name: string;
  color: PaletteColorKey;
  icon: string;
};

export type AppointmentInput = {
  title: string;
  description: string | null;
  location: string | null;
  categoryId: string | null;
  startDate: DateKey;
  startTime: TimeKey | null;
  endDate: DateKey;
  endTime: TimeKey | null;
  allDay: boolean;
  recurrence: Recurrence;
  reminderMinutes: ReminderMinutes | null;
};

export type Appointment = AppointmentInput & {
  id: string;
  recurrenceUntil: DateKey | null;
  /** Occurrence start dates removed from the series. */
  exceptions: DateKey[];
  category: AppointmentCategory | null;
};

/** Which part of a recurring series an edit or delete applies to. */
export type SeriesScope = 'occurrence' | 'future' | 'series';

export type CalendarEventSource = 'appointment' | 'task' | 'finance' | 'goal';

/**
 * Unified, render-only model. Each event points back to its source record;
 * nothing from other modules is copied into the appointments table.
 */
export type CalendarEvent = {
  key: string;
  source: CalendarEventSource;
  /** Day this entry is shown on. */
  date: DateKey;
  title: string;
  subtitle: string | null;
  startTime: TimeKey | null;
  endTime: TimeKey | null;
  allDay: boolean;
  /** Category color (appointments) or the source's fixed color. */
  color: string;
  icon: string;
  hasReminder: boolean;
  done: boolean;
  ref:
    | { kind: 'appointment'; id: string; occurrenceDate: DateKey }
    | { kind: 'task'; id: string }
    | { kind: 'finance' }
    | { kind: 'goal'; id: string };
};
