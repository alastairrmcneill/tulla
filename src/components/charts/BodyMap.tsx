import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { localDateString } from '@/lib/date';
import { enqueue } from '@/lib/offline-queue';
import { useTheme } from '@/theme';

/**
 * Coarse regions (CODING_PLAN.md's locked "Body map regions" row). `id` is
 * the value written to `body_map_entries.location` — shared between the
 * front and back definitions for arm/leg, since it's the same physical limb
 * viewed from either side; only the torso/head split differs per view.
 */
type RegionId =
  | 'head_neck'
  | 'shoulder_left'
  | 'shoulder_right'
  | 'arm_left'
  | 'arm_right'
  | 'chest'
  | 'abdomen'
  | 'leg_left'
  | 'leg_right'
  | 'neck'
  | 'upper_back'
  | 'lower_back';

type Severity = 'mild' | 'moderate' | 'severe';

type Region = {
  id: RegionId;
  label: string;
  shape: { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number } | { kind: 'circle'; cx: number; cy: number; r: number };
};

const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT = 370;

/**
 * No real body-silhouette artwork exists yet (`design-reference`'s `onBody`
 * screen is a placeholder grid, not real art) — this is a coarse geometric
 * approximation, sized only to place the 9 front / 7 back tappable regions
 * correctly. Swap for real art later without changing the region contract.
 *
 * Screen position follows the standard anatomical-chart convention: a front
 * view mirrors left/right (the athlete's right side reads on the viewer's
 * left, as if looking at a mirror or an X-ray), a back view does not.
 */
const FRONT_REGIONS: Region[] = [
  { id: 'head_neck', label: 'Head and neck', shape: { kind: 'circle', cx: 100, cy: 36, r: 26 } },
  { id: 'shoulder_right', label: 'Right shoulder', shape: { kind: 'rect', x: 36, y: 68, width: 36, height: 22, rx: 11 } },
  { id: 'shoulder_left', label: 'Left shoulder', shape: { kind: 'rect', x: 128, y: 68, width: 36, height: 22, rx: 11 } },
  { id: 'arm_right', label: 'Right arm', shape: { kind: 'rect', x: 14, y: 92, width: 30, height: 112, rx: 15 } },
  { id: 'arm_left', label: 'Left arm', shape: { kind: 'rect', x: 156, y: 92, width: 30, height: 112, rx: 15 } },
  { id: 'chest', label: 'Chest', shape: { kind: 'rect', x: 64, y: 92, width: 72, height: 50, rx: 16 } },
  { id: 'abdomen', label: 'Abdomen', shape: { kind: 'rect', x: 68, y: 144, width: 64, height: 48, rx: 16 } },
  { id: 'leg_right', label: 'Right leg', shape: { kind: 'rect', x: 64, y: 196, width: 32, height: 150, rx: 16 } },
  { id: 'leg_left', label: 'Left leg', shape: { kind: 'rect', x: 104, y: 196, width: 32, height: 150, rx: 16 } },
];

const BACK_REGIONS: Region[] = [
  { id: 'neck', label: 'Neck', shape: { kind: 'rect', x: 82, y: 62, width: 36, height: 20, rx: 10 } },
  { id: 'upper_back', label: 'Upper back', shape: { kind: 'rect', x: 64, y: 86, width: 72, height: 58, rx: 16 } },
  { id: 'lower_back', label: 'Lower back', shape: { kind: 'rect', x: 68, y: 148, width: 64, height: 44, rx: 16 } },
  { id: 'arm_left', label: 'Left arm', shape: { kind: 'rect', x: 14, y: 92, width: 30, height: 112, rx: 15 } },
  { id: 'arm_right', label: 'Right arm', shape: { kind: 'rect', x: 156, y: 92, width: 30, height: 112, rx: 15 } },
  { id: 'leg_left', label: 'Left leg', shape: { kind: 'rect', x: 64, y: 196, width: 32, height: 150, rx: 16 } },
  { id: 'leg_right', label: 'Right leg', shape: { kind: 'rect', x: 104, y: 196, width: 32, height: 150, rx: 16 } },
];

const SEVERITIES: Severity[] = ['mild', 'moderate', 'severe'];

export type BodyMapProps = {
  /** Fired after a region's severity is confirmed and successfully queued (3.6 uses this to react at the screen level). */
  onEntrySaved?: (entry: { location: RegionId; severity: Severity }) => void;
};

export function BodyMap({ onEntrySaved }: BodyMapProps) {
  const { colors, spacing, radius, typography, layout, opacity } = useTheme();
  const { user } = useAuth();

  const [view, setView] = useState<'front' | 'back'>('front');
  const [markedRegions, setMarkedRegions] = useState<Set<RegionId>>(new Set());
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  const headSilhouette = view === 'back' ? { cx: 100, cy: 36, r: 26 } : null;

  function openSheet(region: Region) {
    setActiveRegion(region);
    setSeverity(null);
    setNote('');
  }

  function closeSheet() {
    setActiveRegion(null);
  }

  async function handleConfirm() {
    if (!activeRegion || !severity || !user) return;
    setSubmitting(true);
    try {
      await enqueue('body_map_entry', {
        profile_id: user.id,
        // Capture-time date, not sync-time — a queued item can sync after
        // this calendar day ends (2.1's principle, same reasoning as
        // daily_checkins/rpe_logs).
        date: localDateString(),
        location: activeRegion.id,
        severity,
        note: note.trim() || null,
      });
      setMarkedRegions((prev) => new Set(prev).add(activeRegion.id));
      onEntrySaved?.({ location: activeRegion.id, severity });
      closeSheet();
    } finally {
      setSubmitting(false);
    }
  }

  const styles = getStyles({ colors, spacing, radius, typography, layout, opacity });

  return (
    <View>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setView('front')}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'front' }}
          style={[styles.tab, view === 'front' && styles.tabActive]}
        >
          <ThemedText type="smallBold" themeColor={view === 'front' ? 'onAccent' : 'textSecondary'}>
            FRONT
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setView('back')}
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'back' }}
          style={[styles.tab, view === 'back' && styles.tabActive]}
        >
          <ThemedText type="smallBold" themeColor={view === 'back' ? 'onAccent' : 'textSecondary'}>
            BACK
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.figureContainer}>
        <Svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} width="100%" height="100%">
          {/* Decorative head on the back view — not tappable, "neck" carries the back's top-of-figure region. */}
          {headSilhouette ? <Circle cx={headSilhouette.cx} cy={headSilhouette.cy} r={headSilhouette.r} fill={colors.surface} stroke={colors.border} strokeWidth={1} /> : null}

          {regions.map((region) => {
            const marked = markedRegions.has(region.id);
            const fill = marked ? colors.status.warning.surface : colors.surface;
            const stroke = marked ? colors.status.warning.icon : colors.border;
            const shared = {
              key: region.id,
              onPress: () => openSheet(region),
              fill,
              stroke,
              strokeWidth: marked ? 2 : 1,
              accessible: true,
              accessibilityRole: 'button' as const,
              accessibilityLabel: marked ? `${region.label}, marked` : region.label,
              accessibilityHint: 'Opens a severity picker',
            };
            return region.shape.kind === 'circle' ? (
              <Circle {...shared} cx={region.shape.cx} cy={region.shape.cy} r={region.shape.r} />
            ) : (
              <Rect {...shared} x={region.shape.x} y={region.shape.y} width={region.shape.width} height={region.shape.height} rx={region.shape.rx} />
            );
          })}
        </Svg>
      </View>

      {/* Inline expanding panel below the figure, matching design-reference exactly — not a second sheet stacked over 3.6's BodyMapSheet, which already hosts this whole component. */}
      {activeRegion && (
        <View style={styles.inlinePanel}>
          <View style={styles.inlinePanelHeader}>
            <ThemedText type="subtitle">{activeRegion.label} — how bad?</ThemedText>
            <Pressable onPress={closeSheet} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textTertiary">
                ✕
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.severityRow}>
            {SEVERITIES.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSeverity(s)}
                accessibilityRole="radio"
                accessibilityState={{ selected: severity === s }}
                style={[styles.severityChip, severity === s && styles.severityChipActive]}
              >
                <ThemedText type="smallBold" themeColor={severity === s ? 'onAccent' : 'text'} style={styles.capitalize}>
                  {s}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.textTertiary}
            style={styles.noteInput}
            maxLength={140}
          />

          <Pressable
            onPress={handleConfirm}
            disabled={!severity || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !severity || submitting }}
            style={[styles.confirmButton, (!severity || submitting) && styles.confirmButtonDisabled]}
          >
            <ThemedText type="smallBold" themeColor="onAccent">
              {submitting ? 'SAVING…' : 'CONFIRM'}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function getStyles({ colors, spacing, radius, typography, layout, opacity }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'typography' | 'layout' | 'opacity'>) {
  return StyleSheet.create({
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.xxs,
      backgroundColor: colors.surface,
      borderRadius: radius.medium,
      alignSelf: 'flex-start',
    },
    tab: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.small,
      minHeight: layout.minTouchTarget,
      justifyContent: 'center',
    },
    tabActive: {
      backgroundColor: colors.accent,
    },
    figureContainer: {
      width: '100%',
      aspectRatio: VIEWBOX_WIDTH / VIEWBOX_HEIGHT,
      marginTop: spacing.lg,
    },
    inlinePanel: {
      marginTop: spacing.lg,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.extraLarge2,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    inlinePanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    severityRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    severityChip: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.small,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      minHeight: layout.minTouchTarget,
      justifyContent: 'center',
    },
    severityChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    capitalize: {
      textTransform: 'capitalize',
    },
    noteInput: {
      ...typography.bodyMedium,
      color: colors.text,
      backgroundColor: colors.surface,
      borderRadius: radius.medium,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: layout.minTouchTarget,
    },
    confirmButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.extraLarge,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      minHeight: layout.minTouchTarget,
      justifyContent: 'center',
    },
    confirmButtonDisabled: {
      opacity: opacity.disabled,
    },
  });
}
