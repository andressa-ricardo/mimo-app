import { useEffect, useState } from 'react';

import { initializeDatabase } from '@/database/client';
import {
  getAppearancePreferences,
  getProfilePreferences,
} from '@/database/repositories/preferences-repository';
import { initializeAppDirectories } from '@/services/storage/app-directories';
import {
  defaultAppearancePreferences,
  defaultProfilePreferences,
  type AppearancePreferences,
  type ProfilePreferences,
} from '@/types/preferences';

type BootstrapState =
  | { status: 'loading'; appearance: AppearancePreferences; profile: ProfilePreferences }
  | { status: 'ready'; appearance: AppearancePreferences; profile: ProfilePreferences }
  | {
      status: 'error';
      appearance: AppearancePreferences;
      profile: ProfilePreferences;
      error: Error;
    };

export function useAppBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>({
    status: 'loading',
    appearance: defaultAppearancePreferences,
    profile: defaultProfilePreferences,
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await initializeDatabase();
        initializeAppDirectories();
        const [appearance, profile] = await Promise.all([
          getAppearancePreferences(),
          getProfilePreferences(),
        ]);
        if (active) setState({ status: 'ready', appearance, profile });
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        console.error('Falha ao inicializar o Mimo.', normalizedError);
        if (active) {
          setState({
            status: 'error',
            appearance: defaultAppearancePreferences,
            profile: defaultProfilePreferences,
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
