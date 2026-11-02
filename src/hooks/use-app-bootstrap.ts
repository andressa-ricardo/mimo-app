import { useEffect, useState } from 'react';

import { initializeDatabase } from '@/database/client';
import { getAppearancePreferences } from '@/database/repositories/preferences-repository';
import { initializeAppDirectories } from '@/services/storage/app-directories';
import {
  defaultAppearancePreferences,
  type AppearancePreferences,
} from '@/types/preferences';

type BootstrapState =
  | { status: 'loading'; preferences: AppearancePreferences }
  | { status: 'ready'; preferences: AppearancePreferences }
  | { status: 'error'; preferences: AppearancePreferences; error: Error };

export function useAppBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>({
    status: 'loading',
    preferences: defaultAppearancePreferences,
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await initializeDatabase();
        initializeAppDirectories();
        const preferences = await getAppearancePreferences();
        if (active) setState({ status: 'ready', preferences });
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        console.error('Falha ao inicializar o Mimo.', normalizedError);
        if (active) {
          setState({
            status: 'error',
            preferences: defaultAppearancePreferences,
            error: normalizedError,
          });
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
