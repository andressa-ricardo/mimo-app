import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BottomSheet, BottomSheetFooter, BottomSheetScrollView } from '@/components/forms/bottom-sheet';
import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import { ChoiceDialog } from '@/components/ui/choice-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getAppointment } from '@/database/repositories/appointments-repository';
import { reminderOptions } from '@/features/calendar/components/appointment-sheet';
import { formatAgendaHeading } from '@/features/calendar/components/day-agenda';
import { recurrenceLabels } from '@/features/calendar/recurrence';
import { removeAppointment } from '@/features/calendar/save-appointment';
import { paletteColor } from '@/theme/category-colors';
import { useAppTheme } from '@/theme/theme-provider';
import type { Appointment, SeriesScope } from '@/types/calendar';
import { addDaysToDateKey, daysBetween, type DateKey } from '@/utils/date';

export type AppointmentRef = { id: string; occurrenceDate: DateKey };

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Ionicons color={colors.textSecondary} name={icon} size={17} />
      <AppText style={styles.flex}>{text}</AppText>
    </View>
  );
}

function describeWhen(appointment: Appointment, occurrenceDate: DateKey): string {
  const endDate = addDaysToDateKey(occurrenceDate, daysBetween(appointment.startDate, appointment.endDate));
  const multiDay = endDate !== occurrenceDate;
  if (appointment.allDay) {
    return multiDay
      ? `${formatAgendaHeading(occurrenceDate)} até ${formatAgendaHeading(endDate)} · dia todo`
      : `${formatAgendaHeading(occurrenceDate)} · dia todo`;
  }
  return multiDay
    ? `${formatAgendaHeading(occurrenceDate)}, ${appointment.startTime} até ${formatAgendaHeading(endDate)}, ${appointment.endTime}`
    : `${formatAgendaHeading(occurrenceDate)} · ${appointment.startTime} – ${appointment.endTime}`;
}

function Details({
  onDeleted,
  onEdit,
  reference,
}: {
  onDeleted: (message: string) => void;
  onEdit: (appointment: Appointment, occurrenceDate: DateKey) => void;
  reference: AppointmentRef;
}) {
  const { colors, isDark } = useAppTheme();
  const [appointment, setAppointment] = useState<Appointment | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<'single' | 'scope' | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    getAppointment(reference.id)
      .then((loaded) => {
        if (active) setAppointment(loaded);
      })
      .catch(() => {
        if (active) setAppointment(null);
      });
    return () => {
      active = false;
    };
  }, [reference.id]);

  if (appointment === undefined) return <ActivityIndicator color={colors.accent} style={styles.loading} />;
  if (appointment === null) {
    return (
      <BottomSheetScrollView>
        <AppText color="secondary">Este compromisso não existe mais.</AppText>
      </BottomSheetScrollView>
    );
  }

  const recurring = appointment.recurrence !== 'none';
  const reminder = reminderOptions.find((option) => option.value === appointment.reminderMinutes);

  const remove = async (scope: SeriesScope) => {
    if (deleting) return;
    setDeleting(true);
    try {
      onDeleted(await removeAppointment(appointment, reference.occurrenceDate, scope));
    } catch (error: unknown) {
      console.error('Falha ao excluir compromisso.', error);
      setDeleting(false);
      setConfirm(null);
    }
  };

  return (
    <>
      <BottomSheetScrollView>
        <View style={styles.titleRow}>
          {appointment.category ? (
            <View style={[styles.categoryDot, { backgroundColor: paletteColor(appointment.category.color, isDark) }]} />
          ) : null}
          <AppText style={styles.title}>{appointment.title}</AppText>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row icon="time-outline" text={describeWhen(appointment, reference.occurrenceDate)} />
          {recurring ? <Row icon="repeat-outline" text={recurrenceLabels[appointment.recurrence]} /> : null}
          {appointment.location ? <Row icon="location-outline" text={appointment.location} /> : null}
          {appointment.category ? <Row icon="pricetag-outline" text={appointment.category.name} /> : null}
          <Row icon="notifications-outline" text={reminder ? `Lembrete: ${reminder.label.toLowerCase()}` : 'Sem lembrete'} />
        </View>
        {appointment.description ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText>{appointment.description}</AppText>
          </View>
        ) : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={styles.actions}>
          <View style={styles.flex}>
            <PrimaryButton
              disabled={deleting}
              icon="trash-outline"
              label="Excluir"
              onPress={() => setConfirm(recurring ? 'scope' : 'single')}
              variant="outlined"
            />
          </View>
          <View style={styles.flex}>
            <PrimaryButton
              icon="pencil-outline"
              label="Editar"
              onPress={() => onEdit(appointment, reference.occurrenceDate)}
            />
          </View>
        </View>
      </BottomSheetFooter>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={deleting}
        message={`"${appointment.title}" será excluído e o lembrete cancelado.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove('series')}
        title="Excluir compromisso?"
        tone="destructive"
        visible={confirm === 'single'}
      />
      <ChoiceDialog
        choices={[
          { label: 'Só esta ocorrência', onPress: () => void remove('occurrence'), tone: 'destructive' },
          { label: 'Esta e as próximas', onPress: () => void remove('future'), tone: 'destructive' },
          { label: 'Toda a série', onPress: () => void remove('series'), tone: 'destructive' },
        ]}
        loading={deleting}
        message="Este compromisso se repete. O que você quer excluir?"
        onCancel={() => setConfirm(null)}
        title="Excluir compromisso recorrente"
        visible={confirm === 'scope'}
      />
    </>
  );
}

type AppointmentDetailsSheetProps = {
  onClose: () => void;
  onDeleted: (message: string) => void;
  onEdit: (appointment: Appointment, occurrenceDate: DateKey) => void;
  reference: AppointmentRef | null;
};

export function AppointmentDetailsSheet({ onClose, onDeleted, onEdit, reference }: AppointmentDetailsSheetProps) {
  const [shown, setShown] = useState<AppointmentRef | null>(null);
  if (reference && reference !== shown) setShown(reference);

  return (
    <BottomSheet onRequestClose={onClose} title="Compromisso" visible={reference !== null}>
      {shown ? <Details key={`${shown.id}:${shown.occurrenceDate}`} onDeleted={onDeleted} onEdit={onEdit} reference={shown} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  categoryDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  flex: {
    flex: 1,
  },
  loading: {
    marginVertical: 32,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  title: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
