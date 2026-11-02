import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import {
  getNoticeState,
  markStorageNoticeSeen,
  snoozeBackupReminder,
  type NoticeState,
} from '@/database/repositories/notices-repository';
import { BackupError, exportBackup, getStorageSummary } from '@/services/backup/backup-service';
import { useAppTheme } from '@/theme/theme-provider';

const DAY_MS = 86_400_000;
/** Remind when the last backup is older than this. */
const BACKUP_INTERVAL_DAYS = 30;
/** "Agora não" hides the reminder for this long. */
const SNOOZE_DAYS = 7;

const storagePoints: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Tudo fica neste celular',
    text: 'O Mimo não tem conta, nuvem nem sincronização. Nada do que você guarda vai para a internet.',
  },
  {
    icon: 'warning-outline',
    title: 'Desinstalar apaga tudo',
    text: 'Se você desinstalar o app ou limpar os dados dele, suas informações serão apagadas e não há como recuperar.',
  },
  {
    icon: 'cloud-download-outline',
    title: 'Faça backups de vez em quando',
    text: 'Em Configurações → Exportar backup, você salva uma cópia no Drive, nos arquivos ou onde preferir.',
  },
  {
    icon: 'image-outline',
    title: 'Fotos ocupam pouco espaço',
    text: 'Imagens são reduzidas e comprimidas antes de salvar. A foto original da sua galeria não é alterada.',
  },
];

function StorageNotice({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Modal animationType="fade" navigationBarTranslucent onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.background }]}>
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <Ionicons color={colors.accent} name="lock-closed-outline" size={22} />
          </View>
          <AppText accessibilityRole="header" style={styles.dialogTitle} variant="section">
            Seus dados ficam com você
          </AppText>
          <View style={styles.points}>
            {storagePoints.map((point) => (
              <View key={point.title} style={styles.point}>
                <Ionicons color={colors.accent} name={point.icon} size={18} style={styles.pointIcon} />
                <View style={styles.flex}>
                  <AppText variant="label">{point.title}</AppText>
                  <AppText color="secondary" variant="caption">
                    {point.text}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
          <PrimaryButton label="Entendi" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

type NoticeData = NoticeState & { hasData: boolean; now: number };

async function loadNoticeData(): Promise<NoticeData> {
  const [notices, storage] = await Promise.all([getNoticeState(), getStorageSummary()]);
  return {
    ...notices,
    hasData: storage.transactions + storage.tasks + storage.wishlistItems > 0,
    now: Date.now(),
  };
}

function daysSince(timestamp: number, now: number): number {
  return Math.floor((now - timestamp) / DAY_MS);
}

/**
 * First-run storage notice (once) and a gentle backup reminder when the user
 * has data and no recent backup. Both are stored in app_settings.
 */
export function HomeNotices({ onFeedback }: { onFeedback: (message: string) => void }) {
  const { colors } = useAppTheme();
  const [state, setState] = useState<NoticeData | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    loadNoticeData()
      .then((data) => {
        if (active) setState(data);
      })
      .catch((error: unknown) => console.warn('Falha ao carregar avisos.', error));
    return () => {
      active = false;
    };
  }, []);

  if (!state) return null;

  const closeNotice = () => {
    setState((current) => (current ? { ...current, storageNoticeSeen: true } : current));
    markStorageNoticeSeen().catch((error: unknown) => console.warn('Falha ao salvar aviso.', error));
  };

  const backupIsOld = state.lastBackupAt === null || daysSince(state.lastBackupAt, state.now) >= BACKUP_INTERVAL_DAYS;
  const snoozed = state.backupSnoozedUntil !== null && state.backupSnoozedUntil > state.now;
  const showReminder = state.storageNoticeSeen && state.hasData && backupIsOld && !snoozed;

  const snooze = () => {
    const until = Date.now() + SNOOZE_DAYS * DAY_MS;
    setState((current) => (current ? { ...current, backupSnoozedUntil: until } : current));
    snoozeBackupReminder(until).catch((error: unknown) => console.warn('Falha ao adiar lembrete.', error));
  };

  const backupNow = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportBackup();
      setState(await loadNoticeData());
    } catch (error: unknown) {
      if (!(error instanceof BackupError)) console.error('Falha ao exportar backup.', error);
      onFeedback(error instanceof BackupError ? error.message : 'Não foi possível exportar o backup.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {showReminder ? (
        <View style={[styles.reminder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.reminderIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons color={colors.accent} name="shield-checkmark-outline" size={18} />
          </View>
          <View style={styles.flex}>
            <AppText variant="label">Faça um backup dos seus dados</AppText>
            <AppText color="secondary" variant="caption">
              {state.lastBackupAt === null
                ? 'Você ainda não salvou nenhuma cópia. Se o app for desinstalado, tudo se perde.'
                : `Seu último backup foi há ${daysSince(state.lastBackupAt, state.now)} dias.`}
            </AppText>
            <View style={styles.reminderActions}>
              <Pressable accessibilityRole="button" disabled={exporting} hitSlop={8} onPress={() => void backupNow()}>
                {exporting ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <AppText color="accent" variant="label">
                    Fazer backup
                  </AppText>
                )}
              </Pressable>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={snooze}>
                <AppText color="secondary" variant="label">
                  Agora não
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      <StorageNotice onClose={closeNotice} visible={!state.storageNoticeSeen} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  dialog: {
    borderRadius: 24,
    gap: 16,
    maxWidth: 380,
    padding: 22,
    width: '100%',
  },
  dialogTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  point: {
    flexDirection: 'row',
    gap: 12,
  },
  pointIcon: {
    marginTop: 1,
  },
  points: {
    gap: 14,
  },
  reminder: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  reminderIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});
