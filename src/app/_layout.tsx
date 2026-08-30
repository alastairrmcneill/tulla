import { DarkTheme, DefaultTheme, ThemeProvider as RouterThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { initMixpanel } from '@/lib/mixpanel';
import { Sentry, initSentry } from '@/lib/sentry';
import { ThemeProvider, useTheme } from '@/theme';

initSentry();
SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { mode } = useTheme();
  return (
    <RouterThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </RouterThemeProvider>
  );
}

function TabLayout() {
  useEffect(() => {
    initMixpanel();
  }, []);

  return (
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  );
}

export default Sentry.wrap(TabLayout);
