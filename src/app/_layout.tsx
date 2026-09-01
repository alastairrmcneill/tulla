import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as RouterThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { initMixpanel } from '@/lib/mixpanel';
import { initOfflineQueue } from '@/lib/offline-queue';
import { persistOptions, queryClient } from '@/lib/query-client';
import { Sentry, initSentry } from '@/lib/sentry';
import { ThemeProvider, useTheme } from '@/theme';

initSentry();
SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { mode } = useTheme();
  return (
    <RouterThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="team" options={{ headerShown: false }} />
        <Stack.Screen name="join/[code]" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="log-session" options={{ presentation: 'modal' }} />
      </Stack>
    </RouterThemeProvider>
  );
}

function RootLayout() {
  useEffect(() => {
    initMixpanel();
    return initOfflineQueue();
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider>
        <Navigation />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
