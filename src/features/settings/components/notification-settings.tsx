import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ToggleField, ToggleGroup } from '@/components/forms/toggle-field';
import { AppText } from '@/components/ui/app-text';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/database/repositories/preferences-repository';
import { syncBillRemindersNow, syncTaskRemindersNow } from '@/services/notifications/notification-sync';
import { ensureReminderPermission } from '@/services/notifications/task-reminders';
import type { NotificationPreferences } from '@/types/preferences';

type PreferenceKey = keyof NotificationPreferences;

const options: { key: PreferenceKey; label: string }[] = [
  { key: 'taskReminders', label: 'Lembretes de tarefas' },
  { key: 'billReminders', label: 'Vencimentos de contas' },
  { key: 'goalProgress', label: 'Progresso de metas' },
];

export function NotificationSettings({ onFeedback }: { onFeedback: (message: string) => void }) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [busyKey, setBusyKey] = useState<PreferenceKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getNotificationPreferences()
      .then((loaded) => {
        if (active) setPreferences(loaded);
      })
      .catch((error: unknown) => console.warn('Falha ao carregar notificações.', error));
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (key: PreferenceKey, enabled: boolean) => {
    if (!preferences || busyKey) return;
    setBusyKey(key);
    setNotice(null);
    try {
      if (enabled) {
        const permission = await ensureReminderPermission();
        if (permission !== 'granted') {
          setNotice(
            permission === 'denied'
              ? 'As notificações estão bloqueadas. Ative-as nas configurações do sistema para receber avisos.'
              : 'Notificações não estão disponíveis neste dispositivo.',
          );
          return;
        }
      }

      const next = { ...preferences, [key]: enabled };
      await saveNotificationPreferences(next);
      setPreferences(next);
      // Rebuild the affected reminders so the change takes effect right away.
      if (key === 'taskReminders') await syncTaskRemindersNow();
      if (key === 'billReminders') await syncBillRemindersNow();
    } catch (error: unknown) {
      console.error('Falha ao salvar notificações.', error);
      onFeedback('Não foi possível salvar a preferência.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={styles.section}>
      <AppText variant="label">Notificações locais</AppText>
      <ToggleGroup>
        {options.map((option) => (
          <ToggleField
            disabled={preferences === null || busyKey !== null}
            key={option.key}
            label={option.label}
            onChange={(enabled) => void toggle(option.key, enabled)}
            value={preferences?.[option.key] ?? false}
          />
        ))}
      </ToggleGroup>
      {notice ? (
        <AppText color="secondary" variant="caption">
          {notice}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
});
