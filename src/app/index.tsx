import { Redirect } from 'expo-router';

import { useAppTheme } from '@/theme/theme-provider';

export default function EntryRoute() {
  const { profile } = useAppTheme();

  return profile.onboardingCompleted ? (
    <Redirect href="/(tabs)" />
  ) : (
    <Redirect href="/onboarding" />
  );
}
