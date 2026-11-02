import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoreModulesMenu } from '@/components/navigation/more-modules-menu';
import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FilterChip } from '@/components/ui/filter-chip';
import { SwipeView } from '@/components/ui/swipe-view';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { listTasks } from '@/database/repositories/tasks-repository';
import { useNow } from '@/features/quick-actions/use-form-options';
import { TaskQuickSheet } from '@/features/quick-actions/task-quick-sheet';
import { removeTask, toggleTaskCompleted } from '@/features/tasks/create-task';
import { subscribeToDataChanges } from '@/services/events/data-events';
import { priorityColor, priorityLabels, priorityRank } from '@/theme/priority';
import { useAppTheme } from '@/theme/theme-provider';
import type { TaskItem } from '@/types/tasks';
import { parseDateKey, toDateKey, toTimeKey } from '@/utils/date';

type Filter = 'upcoming' | 'overdue' | 'done';

const filters: { value: Filter; label: string }[] = [
  { value: 'upcoming', label: 'Próximas' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'done', label: 'Concluídas' },
];

const filterOrder = filters.map((option) => option.value);

const emptyMessages: Record<Filter, string> = {
  upcoming: 'Nenhuma tarefa por vir. Use “+ Tarefa” na Home para criar uma.',
  overdue: 'Nada atrasado. Muito bem!',
  done: 'Nenhuma tarefa concluída ainda.',
};

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

function isOverdue(task: TaskItem, today: string, nowTime: string): boolean {
  if (task.completedAt !== null || task.dueDate === null) return false;
  return task.dueDate < today || (task.dueDate === today && task.dueTime !== null && task.dueTime < nowTime);
}

/** Undated tasks go last; then by date, time and priority. */
function compareByDue(a: TaskItem, b: TaskItem): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.dueTime !== b.dueTime) {
    if (a.dueTime === null) return 1;
    if (b.dueTime === null) return -1;
    return a.dueTime < b.dueTime ? -1 : 1;
  }
  return priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt - b.createdAt;
}

function describeTask(task: TaskItem): string {
  const parts: string[] = [];
  if (task.dueDate) parts.push(shortDate.format(parseDateKey(task.dueDate)).replace('.', ''));
  if (task.dueTime) parts.push(task.dueTime);
  if (task.categoryName) parts.push(task.categoryName);
  return parts.length > 0 ? parts.join(' · ') : 'Sem prazo';
}

function useTasks() {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; tasks: TaskItem[] }>({
    status: 'loading',
    tasks: [],
  });

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const load = () => {
      const currentRequest = ++requestId;
      listTasks()
        .then((tasks) => {
          if (active && currentRequest === requestId) setState({ status: 'ready', tasks });
        })
        .catch((error: unknown) => {
          console.error('Falha ao carregar tarefas.', error);
          if (active && currentRequest === requestId) setState((current) => ({ ...current, status: 'error' }));
        });
    };
    load();
    const unsubscribe = subscribeToDataChanges((scope) => {
      if (scope === 'tasks') load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

type TaskRowProps = {
  first: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  overdue: boolean;
  task: TaskItem;
};

function TaskRow({ first, onDelete, onEdit, onToggle, overdue, task }: TaskRowProps) {
  const { colors } = useAppTheme();
  const done = task.completedAt !== null;

  return (
    <Pressable
      accessibilityHint="Abre a edição da tarefa"
      accessibilityLabel={`${task.title}, ${describeTask(task)}${done ? ', concluída' : ''}`}
      accessibilityRole="button"
      onPress={onEdit}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: colors.muted },
      ]}>
      <Pressable
        accessibilityLabel={done ? 'Marcar como não concluída' : 'Concluir tarefa'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        hitSlop={10}
        onPress={onToggle}
        style={[
          styles.check,
          done
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { borderColor: colors.textSecondary },
        ]}>
        {done ? <Ionicons color={colors.onAccent} name="checkmark" size={13} /> : null}
      </Pressable>

      <View style={styles.copy}>
        <AppText
          color={done ? 'secondary' : 'primary'}
          numberOfLines={1}
          style={done ? styles.doneTitle : undefined}>
          {task.title}
        </AppText>
        <AppText
          color="secondary"
          numberOfLines={1}
          style={overdue ? { color: colors.error } : undefined}
          variant="caption">
          {describeTask(task)}
        </AppText>
      </View>

      {done ? null : (
        <View
          accessibilityLabel={`Prioridade ${priorityLabels[task.priority].toLowerCase()}`}
          style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority, colors) }]}
        />
      )}
      <Pressable
        accessibilityLabel="Excluir tarefa"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onDelete}
        style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
        <Ionicons color={colors.textSecondary} name="trash-outline" size={17} />
      </Pressable>
    </Pressable>
  );
}

export function TasksScreen() {
  const { colors } = useAppTheme();
  const state = useTasks();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>('upcoming');
  // Tasks toggled while viewing a filter stay visible there (struck through)
  // until the filter changes, so a check can be undone in place.
  const [keptIds, setKeptIds] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TaskItem | null>(null);
  const [busy, setBusy] = useState(false);
  const busyIds = useRef(new Set<string>());
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const hideToast = useCallback(() => setToast(null), []);
  const closeEdit = useCallback(() => setEditing(null), []);
  const closeCreate = useCallback(() => setCreating(false), []);
  const handleCreated = useCallback(
    (text: string) => {
      setCreating(false);
      showToast(text);
    },
    [showToast],
  );
  const handleEdited = useCallback(
    (text: string) => {
      setEditing(null);
      showToast(text);
    },
    [showToast],
  );

  const nowDate = new Date(now);
  const today = toDateKey(nowDate);
  const nowTime = toTimeKey(nowDate);

  const changeFilter = useCallback((next: Filter) => {
    setFilter(next);
    setKeptIds(new Set());
  }, []);
  const showNextFilter = useCallback(
    () => changeFilter(filterOrder[Math.min(filterOrder.indexOf(filter) + 1, filterOrder.length - 1)]),
    [changeFilter, filter],
  );
  const showPreviousFilter = useCallback(
    () => changeFilter(filterOrder[Math.max(filterOrder.indexOf(filter) - 1, 0)]),
    [changeFilter, filter],
  );

  const matchesFilter = (task: TaskItem): boolean => {
    if (keptIds.has(task.id)) return true;
    if (filter === 'done') return task.completedAt !== null;
    if (task.completedAt !== null) return false;
    return filter === 'overdue' ? isOverdue(task, today, nowTime) : !isOverdue(task, today, nowTime);
  };

  const visible = state.tasks
    .filter(matchesFilter)
    .sort((a, b) =>
      filter === 'done' && a.completedAt !== null && b.completedAt !== null
        ? b.completedAt - a.completedAt
        : compareByDue(a, b),
    );

  const toggle = async (task: TaskItem) => {
    if (busyIds.current.has(task.id)) return;
    busyIds.current.add(task.id);
    setKeptIds((current) => new Set(current).add(task.id));
    try {
      await toggleTaskCompleted(task.id, task.completedAt === null);
    } catch (error: unknown) {
      console.error('Falha ao concluir tarefa.', error);
      showToast('Não foi possível atualizar a tarefa.');
    } finally {
      busyIds.current.delete(task.id);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await removeTask(deleting.id);
      setDeleting(null);
      showToast('Tarefa excluída.');
    } catch (error: unknown) {
      console.error('Falha ao excluir tarefa.', error);
      setDeleting(null);
      showToast('Não foi possível excluir a tarefa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText style={styles.flex} variant="title">
            Tasks
          </AppText>
          <Pressable
            accessibilityLabel="Nova tarefa"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setCreating(true)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="add" size={26} />
          </Pressable>
          <MoreModulesMenu />
        </View>

        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}>
          {filters.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              onPress={() => changeFilter(option.value)}
              selected={filter === option.value}
            />
          ))}
        </ScrollView>

        <SwipeView onSwipeLeft={showNextFilter} onSwipeRight={showPreviousFilter} style={styles.swipeArea}>
        {state.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} style={styles.message} />
        ) : state.status === 'error' && state.tasks.length === 0 ? (
          <AppText color="secondary" style={styles.message}>
            Não foi possível carregar suas tarefas.
          </AppText>
        ) : visible.length === 0 ? (
          <View style={[styles.card, styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText color="secondary" style={styles.emptyText} variant="caption">
              {emptyMessages[filter]}
            </AppText>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {visible.map((task, index) => (
              <TaskRow
                first={index === 0}
                key={task.id}
                onDelete={() => setDeleting(task)}
                onEdit={() => setEditing(task)}
                onToggle={() => void toggle(task)}
                overdue={isOverdue(task, today, nowTime)}
                task={task}
              />
            ))}
          </View>
        )}
        </SwipeView>
      </ScrollView>

      <Toast message={toast} onHide={hideToast} />
      <TaskQuickSheet onClose={closeEdit} onSaved={handleEdited} task={editing} visible={editing !== null} />
      <TaskQuickSheet onClose={closeCreate} onSaved={handleCreated} visible={creating} />
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={busy}
        message={deleting ? `"${deleting.title}" será excluída. Essa ação não pode ser desfeita.` : ''}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Excluir tarefa?"
        tone="destructive"
        visible={deleting !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  check: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  // Horizontal ScrollViews grow by default; keep the chip row at its natural height.
  chipRow: {
    flexGrow: 0,
  },
  chips: {
    gap: 7,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: 14,
    maxWidth: 560,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 8,
    width: '100%',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  delete: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 28,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
  empty: {
    padding: 18,
  },
  emptyText: {
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  headerButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  message: {
    marginTop: 32,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  priorityDot: {
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
  },
  screen: {
    flex: 1,
  },
  // Fills the rest of the screen so swiping works below a short list too.
  swipeArea: {
    flexGrow: 1,
  },
});
