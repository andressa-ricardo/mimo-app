import { useCallback, useEffect, useState } from 'react';

import { getWishlistItem, listWishlistItems } from '@/database/repositories/wishlist-repository';
import { subscribeToDataChanges } from '@/services/events/data-events';
import type { WishlistItem } from '@/types/wishlist';

type LoadState<T> =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: null };

/** Loads data and reloads it whenever the wishlist changes elsewhere. */
function useWishlistQuery<T>(load: () => Promise<T>): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading', data: null });

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const run = () => {
      const currentRequest = ++requestId;
      load()
        .then((data) => {
          if (active && currentRequest === requestId) setState({ status: 'ready', data });
        })
        .catch((error: unknown) => {
          console.error('Falha ao carregar a wishlist.', error);
          if (active && currentRequest === requestId) {
            setState((current) => (current.status === 'ready' ? current : { status: 'error', data: null }));
          }
        });
    };

    run();
    const unsubscribe = subscribeToDataChanges((scope) => {
      if (scope === 'wishlist') run();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [load]);

  return state;
}

export function useWishlistItems(): LoadState<WishlistItem[]> {
  return useWishlistQuery(listWishlistItems);
}

export function useWishlistItem(id: string): LoadState<WishlistItem | null> {
  const load = useCallback(() => getWishlistItem(id), [id]);
  return useWishlistQuery(load);
}
