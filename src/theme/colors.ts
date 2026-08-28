/**
 * Colour tokens — dark and light.
 *
 * Dark is the product default (`01-product-spec.md` / the design reference
 * is "Night training": near-black ground, electric lime accent). Light is a
 * palette-swap of the same roles, taken from `Wellness App Light.dc.html`.
 *
 * Naming mirrors what's used at the call site: `colors.background`,
 * `colors.surface`, `colors.text`, `colors.accent`, `colors.status.danger.text`, etc.
 * Never reach for a raw hex/rgba in a component — add or reuse a role here.
 */

/** One severity role: danger / warning / success. Never used for text alone — always pair with an icon or label (product spec §11: never rely on colour alone). */
export type StatusRole = {
  /** Solid colour for an icon, glyph, or chart stroke. */
  icon: string;
  /** Text colour when sitting on that status's `surface` tint. */
  text: string;
  /** Translucent tint background for a chip, banner, or icon tile. */
  surface: string;
  /** Border for an outlined chip or selected tint card. */
  border: string;
};

export type GlassStyle = {
  background: string;
  border: string;
  blurRadius: number;
  /** Fallback flat colour for Android, iOS <26, and Reduce Transparency — never leave a glass surface transparent on these paths (product spec §11). */
  fallbackBackground: string;
};

export type ColorTokens = {
  /** App ground — the base every screen sits on. */
  background: string;
  /** Default card / row background, translucent over `background`. */
  surface: string;
  /** Solid raised surface — small tiles, avatar chips, nested cards on top of `surface`. */
  surfaceElevated: string;
  /** Default hairline border for cards and dividers. */
  border: string;
  /** Higher-contrast border — glass chrome, focused/selected outlines. */
  borderStrong: string;
  /** Full-screen dim behind a modal/sheet. */
  scrim: string;

  /** Primary text. */
  text: string;
  /** Secondary body text, sub-labels. */
  textSecondary: string;
  /** Tertiary text — hints, placeholder-weight labels, timestamps. */
  textTertiary: string;
  /** Disabled text. */
  textDisabled: string;
  /** Disabled control background. */
  surfaceDisabled: string;

  /** Brand lime. Identical in both modes — always paired with `onAccent` when used as a fill. */
  accent: string;
  /** Text/icon colour for content sitting on a solid `accent` fill. */
  onAccent: string;
  /** Accent used directly as text/icon colour on `background` (contrast-safe per mode — do not substitute `accent` here in light mode). */
  accentText: string;
  /** Translucent accent tint — selected pill/card backgrounds. */
  accentSurface: string;

  status: {
    danger: StatusRole;
    warning: StatusRole;
    success: StatusRole;
  };

  glass: {
    tabBar: GlassStyle;
    sheet: GlassStyle;
  };

  /** Shadow colour for a standard elevated card. */
  shadowColor: string;
  /** Shadow colour for an accent glow (primary CTA, active state). */
  shadowColorAccent: string;
};

const dark: ColorTokens = {
  background: '#0B0D0C',
  surface: 'rgba(242,245,241,0.05)',
  surfaceElevated: '#141814',
  border: 'rgba(242,245,241,0.09)',
  borderStrong: 'rgba(242,245,241,0.2)',
  scrim: 'rgba(0,0,0,0.6)',

  text: '#F2F5F1',
  textSecondary: 'rgba(242,245,241,0.55)',
  textTertiary: 'rgba(242,245,241,0.4)',
  textDisabled: 'rgba(242,245,241,0.35)',
  surfaceDisabled: 'rgba(242,245,241,0.08)',

  accent: '#C8FF3D',
  onAccent: '#0B0D0C',
  accentText: '#C8FF3D',
  accentSurface: 'rgba(200,255,61,0.14)',

  status: {
    danger: {
      icon: '#FF5A4E',
      text: '#FF8A80',
      surface: 'rgba(255,90,78,0.14)',
      border: 'rgba(255,90,78,0.3)',
    },
    warning: {
      icon: '#FFC24D',
      text: '#FFD98A',
      surface: 'rgba(255,194,77,0.14)',
      border: 'rgba(255,194,77,0.3)',
    },
    success: {
      icon: '#C8FF3D',
      text: '#C8FF3D',
      surface: 'rgba(200,255,61,0.14)',
      border: 'rgba(200,255,61,0.3)',
    },
  },

  glass: {
    tabBar: {
      background: 'rgba(242,245,241,0.1)',
      border: 'rgba(242,245,241,0.18)',
      blurRadius: 24,
      fallbackBackground: '#171B16',
    },
    sheet: {
      background: 'rgba(28,32,26,0.72)',
      border: 'rgba(242,245,241,0.2)',
      blurRadius: 34,
      fallbackBackground: '#171B16',
    },
  },

  shadowColor: '#000000',
  shadowColorAccent: 'rgba(200,255,61,0.3)',
};

const light: ColorTokens = {
  background: '#F1F2ED',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: 'rgba(11,13,12,0.1)',
  borderStrong: 'rgba(11,13,12,0.14)',
  scrim: 'rgba(11,13,12,0.5)',

  text: '#0B0D0C',
  textSecondary: 'rgba(11,13,12,0.62)',
  textTertiary: 'rgba(11,13,12,0.5)',
  textDisabled: 'rgba(11,13,12,0.35)',
  surfaceDisabled: 'rgba(11,13,12,0.06)',

  accent: '#C8FF3D',
  onAccent: '#0B0D0C',
  accentText: '#4E6E07',
  accentSurface: 'rgba(122,168,10,0.12)',

  status: {
    danger: {
      icon: '#D2412F',
      text: '#A82D1B',
      surface: 'rgba(255,90,78,0.14)',
      border: 'rgba(255,90,78,0.3)',
    },
    warning: {
      icon: '#B07A00',
      text: '#6E4A00',
      surface: 'rgba(255,194,77,0.14)',
      border: 'rgba(255,194,77,0.3)',
    },
    success: {
      icon: '#8CBB12',
      text: '#4E6E07',
      surface: 'rgba(122,168,10,0.14)',
      border: 'rgba(122,168,10,0.3)',
    },
  },

  glass: {
    tabBar: {
      background: 'rgba(255,255,255,0.6)',
      border: 'rgba(255,255,255,0.9)',
      blurRadius: 24,
      fallbackBackground: '#FFFFFF',
    },
    sheet: {
      background: 'rgba(252,253,249,0.78)',
      border: 'rgba(255,255,255,0.9)',
      blurRadius: 34,
      fallbackBackground: '#FFFFFF',
    },
  },

  shadowColor: 'rgba(11,13,12,1)',
  shadowColorAccent: 'rgba(122,168,10,0.3)',
};

export const colors = { dark, light } as const;

export type ColorScheme = keyof typeof colors;
