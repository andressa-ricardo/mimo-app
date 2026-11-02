export type DataChangeScope = 'tasks' | 'finance' | 'wishlist' | 'goals' | 'appointments';

type Listener = (scope: DataChangeScope) => void;

const listeners = new Set<Listener>();

/** Lets screens such as Home refresh after a record is saved elsewhere. */
export function notifyDataChanged(scope: DataChangeScope): void {
  for (const listener of listeners) listener(scope);
}

export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
