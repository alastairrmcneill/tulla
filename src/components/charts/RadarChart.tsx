import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

/**
 * Plain numeric props, no query coupling (3.1/3.2) — 4.6's coach-side reuse
 * just passes different `current`/`baseline` data through the same component.
 */
export type Metric = 'fatigue' | 'sleep' | 'muscle_soreness' | 'stress' | 'mood';

export type RadarChartProps = {
  /** Today's value per metric, 1–5. */
  current: Record<Metric, number>;
  /** `athlete_baseline_14` mean per metric — `null` when that axis's baseline is insufficient (3.1). */
  baseline: Record<Metric, number | null>;
};

/** Geometry lifted straight from `design-reference`'s `onPreview` radar SVG: 200×200 viewBox, centre (100,100), outer radius 72, axes 72° apart starting at 12 o'clock. */
const VIEWBOX_SIZE = 200;
const CENTER = VIEWBOX_SIZE / 2;
const OUTER_RADIUS = 72;
const GRID_RINGS = 3;
const MAX_VALUE = 5;

/** Axis order and short all-caps label match the design reference exactly — "MUSCLES", not "SORENESS". */
const AXES: { metric: Metric; label: string; accessibleLabel: string }[] = [
  { metric: 'fatigue', label: 'FATIGUE', accessibleLabel: 'Fatigue' },
  { metric: 'sleep', label: 'SLEEP', accessibleLabel: 'Sleep' },
  { metric: 'muscle_soreness', label: 'MUSCLES', accessibleLabel: 'Muscle soreness' },
  { metric: 'stress', label: 'STRESS', accessibleLabel: 'Stress' },
  { metric: 'mood', label: 'MOOD', accessibleLabel: 'Mood' },
];

/** Point on the Nth axis at a given radius. Angle 0 is straight up, increasing clockwise — matches the reference markup's hand-computed points. */
export function axisPoint(index: number, radius: number): { x: number; y: number } {
  const angle = (-90 + index * (360 / AXES.length)) * (Math.PI / 180);
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

function valueToRadius(value: number): number {
  const clamped = Math.max(0, Math.min(MAX_VALUE, value));
  return (clamped / MAX_VALUE) * OUTER_RADIUS;
}

function pointsToString(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

export type RadarAxisGeometry = {
  metric: Metric;
  label: string;
  currentPoint: { x: number; y: number };
  baselinePoint: { x: number; y: number };
  /** false when this axis's baseline is still building (3.1's `sufficient=false`, surfaced here as `null`). */
  baselineSufficient: boolean;
  /** VoiceOver/TalkBack summary, e.g. "Fatigue 4 of 5, baseline 3.2" or "...baseline still building". */
  summary: string;
};

/** Pure geometry + accessible-summary calc, factored out of the component so it's exercisable without rendering (this project has no test runner yet — see 3.2's plan note). */
export function computeRadarAxes(current: Record<Metric, number>, baseline: Record<Metric, number | null>): RadarAxisGeometry[] {
  return AXES.map((axis, i) => {
    const currentValue = current[axis.metric];
    const baselineMean = baseline[axis.metric];
    const baselineSufficient = baselineMean !== null;

    return {
      metric: axis.metric,
      label: axis.label,
      currentPoint: axisPoint(i, valueToRadius(currentValue)),
      // Insufficient baseline: plot the baseline vertex at the current-value point
      // (no visible deviation) rather than a misleading zero (3.2's spec).
      baselinePoint: axisPoint(i, valueToRadius(baselineSufficient ? baselineMean : currentValue)),
      baselineSufficient,
      summary: baselineSufficient
        ? `${axis.accessibleLabel} ${currentValue} of ${MAX_VALUE}, baseline ${baselineMean.toFixed(1)}`
        : `${axis.accessibleLabel} ${currentValue} of ${MAX_VALUE}, baseline still building`,
    };
  });
}

export function RadarChart({ current, baseline }: RadarChartProps) {
  const { colors } = useTheme();
  const axes = computeRadarAxes(current, baseline);

  const outerRing = AXES.map((_, i) => axisPoint(i, OUTER_RADIUS));
  const gridRings = Array.from({ length: GRID_RINGS }, (_, ring) => AXES.map((_, i) => axisPoint(i, (OUTER_RADIUS * (ring + 1)) / GRID_RINGS)));

  return (
    <View>
      {/* The SVG itself is a single opaque shape to a screen reader — the real
          per-axis stops are the hidden summary rows below, so hide this from
          the accessibility tree rather than let VoiceOver announce "image". */}
      <View style={styles.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} width="100%" height="100%">
          <G>
            {gridRings.map((ring, i) => (
              <Polygon key={`ring-${i}`} points={pointsToString(ring)} fill="none" stroke={colors.border} strokeWidth={1} />
            ))}
            {outerRing.map((point, i) => (
              <Line key={`spoke-${i}`} x1={CENTER} y1={CENTER} x2={point.x} y2={point.y} stroke={colors.border} strokeWidth={1} />
            ))}

            {/* Baseline polygon: dashed as well as a different colour, so the
                two overlaid shapes never rely on colour alone to be told apart
                (product spec §11). */}
            <Polygon
              points={pointsToString(axes.map((a) => a.baselinePoint))}
              fill="none"
              stroke={colors.textTertiary}
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />

            <Polygon points={pointsToString(axes.map((a) => a.currentPoint))} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" />
            {axes.map((a) => (
              <Circle key={`dot-${a.metric}`} cx={a.currentPoint.x} cy={a.currentPoint.y} r={4} fill={colors.accent} />
            ))}

            {AXES.map((axis, i) => {
              const labelPoint = axisPoint(i, OUTER_RADIUS + 14);
              return (
                <SvgText key={`label-${axis.metric}`} x={labelPoint.x} y={labelPoint.y} textAnchor="middle" fontSize={10} fontWeight="700" fill={colors.textTertiary}>
                  {axis.label}
                </SvgText>
              );
            })}
          </G>
        </Svg>
      </View>

      <View style={styles.srOnly}>
        {axes.map((a) => (
          <ThemedText key={a.metric} accessible accessibilityRole="text" accessibilityLabel={a.summary}>
            {a.summary}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    width: '100%',
    aspectRatio: 1,
  },
  // Standard screen-reader-only pattern: kept in the accessibility tree
  // (unlike `display: none`) but visually collapsed to nothing.
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});
