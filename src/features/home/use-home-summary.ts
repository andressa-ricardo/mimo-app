import { useEffect, useState } from 'react';

import { loadHomeSummary } from '@/features/home/home-data';
import type { HomeSummary } from '@/features/home/home-types';

type HomeSummaryState =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: HomeSummary }
  | { status: 'error'; data: null };

export function useHomeSummary(): HomeSummaryState {
  const [state, setState] = useState<HomeSummaryState>({ status: 'loading', data: null });

  useEffect(() => {
    let active = true;

    void loadHomeSummary()
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ status: 'error', data: null });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
