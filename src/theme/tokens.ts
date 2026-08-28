/**
 * Primitive design tokens.
 *
 * Derived from the exported design references in `/design-reference`. The raw
 * designs used a wide spread of ad-hoc values (radii from 2–38, spacing from
 * 1–120); those have been clustered onto a 4pt grid here. Nothing in the app
 * should use a raw number — always reference a token.
 *
 * These are mode-independent. Colours live in `./colors`.
 */

import { Platform, type TextStyle } from 'react-native';

/* -------------------------------------------------------------------------- */
/* Spacing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 4pt grid. The design's 14px values collapse to `md` (12) or `lg` (16),
 * 18px to `lg`, 22/26px to `2xl` (24).
 */
export const spacing = {
  none: 0,
  /** 2 — hairline gaps, chip inner padding */
  xxs: 2,
  /** 4 — icon-to-label */
  xs: 4,
  /** 8 — tight stacks, chip rows */
  sm: 8,
  /** 12 — default gap inside a card */
  md: 12,
  /** 16 — default card padding, default list gap */
  lg: 16,
  /** 20 — screen horizontal padding */
  xl: 20,
  /** 24 — section padding, generous card padding */
  '2xl': 24,
  /** 32 — between major sections */
  '3xl': 32,
  /** 40 — screen bottom padding */
  '4xl': 40,
  /** 56 — hero top padding above safe area content */
  '5xl': 56,
} as const;

/** Screen-level layout constants used by every route. */
export const layout = {
  /** Horizontal gutter for all screen content. */
  screenHorizontal: spacing.xl,
  /** Space below the safe-area inset at the top of a screen. */
  screenTop: spacing['3xl'],
  /** Space below the last element before the tab bar / safe area. */
  screenBottom: spacing['4xl'],
  /** Max readable measure — used on tablet and web layouts. */
  maxContentWidth: 800,
  /** Minimum tappable target (WCAG 2.5.5 / Apple HIG). */
  minTouchTarget: 44,
  /** Height of the tab bar, excluding the bottom safe-area inset. */
  tabBarHeight: Platform.select({ ios: 50, android: 64, default: 56 }),
  /** Hairline used for glass borders — thinner than a 1px stroke. */
  hairline: Platform.select({ ios: 0.5, default: 1 }),
} as const;

/* -------------------------------------------------------------------------- */
/* Radius                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Named on Material 3's shape scale (matches the naming already used for
 * `typography` roles below). The designs lean heavily on large, soft radii —
 * 11–14 collapse to `small`, 17–22 to `large`, 24–26 to `extraLarge`.
 */
export const radius = {
  none: 0,
  /** 4 — progress bars, tiny indicators */
  extraSmall: 4,
  /** 8 — chips, badges */
  small: 8,
  /** 12 — small icon tiles, inputs */
  medium: 12,
  /** 16 — nested cards, list rows */
  large: 16,
  /** 20 — primary buttons, standard cards */
  extraLarge: 20,
  /** 24 — feature cards, large panels */
  extraLarge2: 24,
  /** 32 — bottom sheet top corners */
  extraLarge3: 32,
  /** Pill / fully rounded. Use for circles too (with equal width & height). */
  full: 999,
} as const;

/* -------------------------------------------------------------------------- */
/* Typography                                                                  */
/* -------------------------------------------------------------------------- */

export const fontFamily = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    sans: 'sans-serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  default: {
    sans: 'System',
    rounded: 'System',
    mono: 'monospace',
  },
}) as { sans: string; rounded: string; mono: string };

export const fontWeight = {
  regular: '400',
  medium: '600',
  semibold: '700',
  bold: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Named text roles. Spread straight into a style:
 *
 *   <Text style={[typography.headlineLarge, { color: colors.text }]} />
 *
 * Colour is deliberately excluded so a role can be used on any surface.
 * `overline` / `overlineSmall` carry `textTransform: 'uppercase'` — the
 * all-caps micro-label is a signature of the design, don't re-implement it.
 */
export const typography = {
  /** 46 — welcome/hero headline only. One per screen, at most. */
  displayLarge: {
    fontFamily: fontFamily.sans,
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -2.2,
    fontWeight: fontWeight.bold,
  },
  /** 40 — oversized numerals (readiness score, streak counts). */
  displayMedium: {
    fontFamily: fontFamily.sans,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.8,
    fontWeight: fontWeight.bold,
  },
  /** 34 — secondary hero, paywall headline. */
  displaySmall: {
    fontFamily: fontFamily.sans,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -1.4,
    fontWeight: fontWeight.bold,
  },

  /** 32 — screen title on a scrolling screen. */
  headlineLarge: {
    fontFamily: fontFamily.sans,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -1.3,
    fontWeight: fontWeight.bold,
  },
  /** 26 — question headline, sheet title. */
  headlineMedium: {
    fontFamily: fontFamily.sans,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: -1,
    fontWeight: fontWeight.bold,
  },
  /** 22 — card headline, empty-state title. */
  headlineSmall: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
    fontWeight: fontWeight.semibold,
  },

  /** 20 — section heading. */
  titleLarge: {
    fontFamily: fontFamily.sans,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    fontWeight: fontWeight.semibold,
  },
  /** 17 — list row title, athlete name. */
  titleMedium: {
    fontFamily: fontFamily.sans,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.2,
    fontWeight: fontWeight.semibold,
  },
  /** 15 — dense row title, sub-section heading. */
  titleSmall: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: -0.1,
    fontWeight: fontWeight.semibold,
  },

  /** 16 — lead paragraph, onboarding body copy. */
  bodyLarge: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: 0,
    fontWeight: fontWeight.regular,
  },
  /** 14 — default body text. */
  bodyMedium: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontWeight: fontWeight.regular,
  },
  /** 13 — supporting copy, helper text under a control. */
  bodySmall: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0,
    fontWeight: fontWeight.regular,
  },

  /** 17 — primary button label. */
  labelLarge: {
    fontFamily: fontFamily.sans,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.2,
    fontWeight: fontWeight.bold,
  },
  /** 13 — chip, secondary button, tag. */
  labelMedium: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0,
    fontWeight: fontWeight.semibold,
  },
  /** 11 — tab bar label, dense metadata. */
  labelSmall: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    fontWeight: fontWeight.semibold,
  },

  /** 11.5 all-caps — the accent kicker above a headline. */
  overline: {
    fontFamily: fontFamily.sans,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 1.5,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  /** 10.5 all-caps — card eyebrow, "EXAMPLE · NOT REAL DATA". */
  overlineSmall: {
    fontFamily: fontFamily.sans,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 1.2,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },

  /** Tabular figures for chart axes and dates. */
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    fontWeight: fontWeight.medium,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyRole = keyof typeof typography;

/* -------------------------------------------------------------------------- */
/* Motion                                                                      */
/* -------------------------------------------------------------------------- */

export const duration = {
  /** 120 — press feedback */
  instant: 120,
  /** 180 — colour/opacity state change */
  fast: 180,
  /** 280 — card enter, accordion */
  normal: 280,
  /** 400 — screen/sheet transition */
  slow: 400,
} as const;

/** Matches the `cubic-bezier(.2,.8,.2,1)` used throughout the designs. */
export const easing = {
  standard: [0.2, 0.8, 0.2, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.4, 0, 1, 1],
} as const;

/* -------------------------------------------------------------------------- */
/* Opacity                                                                     */
/* -------------------------------------------------------------------------- */

export const opacity = {
  disabled: 0.4,
  pressed: 0.7,
  overlay: 0.6,
} as const;
