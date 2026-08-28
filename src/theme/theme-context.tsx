/**
 * App-wide theme provider.
 *
 * Dark is the product default regardless of the device's OS setting (product
 * spec: theme is a user preference, not a system follow) — this provider
 * seeds `dark` and exposes `setMode` for the eventual Settings screen toggle
 * (product spec §"Settings"). Wire that toggle's persistence (profile.theme,
 * technical plan §6) when that screen is built; this provider is in-memory
 * only for now.
 */

import '@/global.css';

import { createContext, useContext, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';

import { colors, type ColorScheme, type ColorTokens } from './colors';
import {
  duration,
  easing,
  fontFamily,
  fontWeight,
  layout,
  opacity,
  radius,
  spacing,
  typography,
} from './tokens';

export type ThemeContextValue = {
  /** Active colour scheme. */
  mode: ColorScheme;
  /** Switch scheme — wire up from the Settings theme toggle. */
  setMode: (mode: ColorScheme) => void;
  /** Resolved colour tokens for the active mode. */
  colors: ColorTokens;
  /** Mode-independent tokens, bundled here for a single `useTheme()` call site. */
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  layout: typeof layout;
  duration: typeof duration;
  easing: typeof easing;
  opacity: typeof opacity;
  fontFamily: typeof fontFamily;
  fontWeight: typeof fontWeight;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_MODE: ColorScheme = 'dark';

// Set at module load, before the native side ever paints, so natively-rendered
// chrome (iOS Liquid Glass NativeTabs, sheets) doesn't flash the device's
// actual system appearance first. `NativeTabs`/`expo-glass-effect` are real
// SwiftUI, so they read the OS trait collection directly — our `colors`
// object alone can't reach them; without this call they'd follow whatever
// the simulator/device is set to (often light) while our JS-driven props
// paint dark on top, producing a light/dark flicker on every tab press.
Appearance.setColorScheme(DEFAULT_MODE);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ColorScheme>(DEFAULT_MODE);

  // Keep native appearance in lock-step whenever `setMode` is called (the
  // future Settings toggle) — same reasoning as the module-level call above.
  useLayoutEffect(() => {
    Appearance.setColorScheme(mode);
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      colors: colors[mode],
      typography,
      spacing,
      radius,
      layout,
      duration,
      easing,
      opacity,
      fontFamily,
      fontWeight,
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Single entry point for every token:
 *
 *   const { colors, typography, spacing, radius } = useTheme();
 *   <Text style={[typography.bodyMedium, { color: colors.text }]} />
 *   <View style={{ padding: spacing.lg, borderRadius: radius.large, backgroundColor: colors.surface }} />
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be called within a <ThemeProvider>.');
  }
  return ctx;
}
