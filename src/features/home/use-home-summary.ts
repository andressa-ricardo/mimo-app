import { useEffect, useState } from 'react';

import { loadHomeSummary } from '@/features/home/home-data';
import type { HomeSummary } from '@/features/home/home-types';
import { subscribeToDataChanges } from '@/services/events/data-events';

type HomeSummaryState =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: HomeSummary }
  | { status: 'error'; data: null };

export function useHomeSummary(): HomeSummaryState {
  const [state, setState] = useState<HomeSummaryState>({ status: 'loading', data: null });

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const load = () => {
      const currentRequest = ++requestId;
      void loadHomeSummary()
        .then((data) => {
          if (active && currentRequest === requestId) setState({ status: 'ready', data });
        })
        .catch((error: unknown) => {
          console.error('Falha ao carregar a Home.', error);
          // Keep showing the last good summary when a refresh fails.
          if (active && currentRequest === requestId) {
            setState((current) => (current.status === 'ready' ? current : { status: 'error', data: null }));
          }
        });
    };

    load();
    const unsubscribe = subscribeToDataChanges(load);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
