import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  BackupError,
  exportBackup,
  getStorageSummary,
  pickBackup,
  restoreBackup,
  summarizeBackup,
  type StorageSummary,
} from '@/services/backup/backup-service';
import type { BackupFile } from '@/services/backup/backup-types';
import { getNoticeState } from '@/database/repositories/notices-repository';
import { subscribeToDataChanges } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import { formatDateKey, toDateKey } from '@/utils/date';

const sizeFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormatter.format(bytes / 1024)} KB`;
  return `${sizeFormatter.format(bytes / (1024 * 1024))} MB`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function describeStorage(summary: StorageSummary): string {
  return [
    `Armazenamento local: ${formatBytes(summary.totalBytes)}`,
    plural(summary.transactions, 'transação', 'transações'),
    plural(summary.tasks, 'tarefa', 'tarefas'),
    plural(summary.wishlistItems, 'desejo', 'desejos'),
  ].join(' · ');
}

function OutlineButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      {loading ? <ActivityIndicator color={colors.accent} /> : <AppText variant="label">{label}</AppText>}
    </Pressable>
  );
}

type DataSettingsProps = {
  onFeedback: (message: string) => void;
  /** Called after a restore so the screen can reload theme and profile. */
  onRestored: () => Promise<void>;
};

export function DataSettings({ onFeedback, onRestored }: DataSettingsProps) {
  const { colors } = useAppTheme();
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<'export' | 'pick' | 'restore' | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);

  const loadSummary = useCallback(() => {
    Promise.all([getStorageSummary(), getNoticeState()])
      .then(([storage, notices]) => {
        setSummary(storage);
        setLastBackupAt(notices.lastBackupAt);
      })
      .catch((error: unknown) => console.warn('Falha ao calcular armazenamento.', error));
  }, []);

  useEffect(() => {
    loadSummary();
    return subscribeToDataChanges(loadSummary);
  }, [loadSummary]);

  const showError = (error: unknown, fallback: string) => {
    if (!(error instanceof BackupError)) console.error(fallback, error);
    onFeedback(error instanceof BackupError ? error.message : fallback);
  };

  const handleExport = async () => {
    if (busy) return;
    setBusy('export');
    try {
      await exportBackup();
      loadSummary();
    } catch (error: unknown) {
      showError(error, 'Não foi possível exportar o backup.');
    } finally {
      setBusy(null);
    }
  };

  const handlePick = async () => {
    if (busy) return;
    setBusy('pick');
    try {
      const backup = await pickBackup();
      if (backup) setPendingBackup(backup);
    } catch (error: unknown) {
      showError(error, 'Não foi possível ler o arquivo de backup.');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!pendingBackup || busy) return;
    setBusy('restore');
    try {
      await restoreBackup(pendingBackup);
      setPendingBackup(null);
      await onRestored();
      loadSummary();
      onFeedback('Backup restaurado.');
    } catch (error: unknown) {
      setPendingBackup(null);
      showError(error, 'Não foi possível restaurar o backup. Seus dados atuais foram mantidos.');
    } finally {
      setBusy(null);
    }
  };

  const backupSummary = pendingBackup ? summarizeBackup(pendingBackup) : null;
  const backupDate =
    backupSummary && !Number.isNaN(Date.parse(backupSummary.createdAt))
      ? formatDateKey(toDateKey(new Date(backupSummary.createdAt)))
      : null;

  return (
    <View style={styles.section}>
      <AppText variant="label">Dados</AppText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText>{summary ? describeStorage(summary) : 'Calculando armazenamento…'}</AppText>
        <AppText color="secondary" style={styles.lastBackup} variant="caption">
          {lastBackupAt === null
            ? 'Nenhum backup exportado ainda.'
            : `Último backup: ${formatDateKey(toDateKey(new Date(lastBackupAt)))}`}
        </AppText>
      </View>
      <OutlineButton label="Exportar backup" loading={busy === 'export'} onPress={() => void handleExport()} />
      <OutlineButton label="Restaurar backup" loading={busy === 'pick'} onPress={() => void handlePick()} />

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Restaurar"
        loading={busy === 'restore'}
        message={
          backupSummary
            ? `${backupDate ? `Backup de ${backupDate} · ` : ''}${plural(backupSummary.transactions, 'transação', 'transações')} · ${plural(
                backupSummary.tasks,
                'tarefa',
                'tarefas',
              )} · ${plural(backupSummary.wishlistItems, 'desejo', 'desejos')}.\n\nOs dados atuais deste aparelho serão substituídos. Essa ação não pode ser desfeita.`
            : ''
        }
        onCancel={() => setPendingBackup(null)}
        onConfirm={() => void handleRestore()}
        title="Restaurar backup?"
        tone="destructive"
        visible={pendingBackup !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  lastBackup: {
    marginTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    gap: 8,
  },
});
