import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';

import { Sentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

/**
 * Offline-first write queue (plan 2.1). Every screen that submits data an
 * athlete might enter with no signal (check-in 3.4, body-map entry 3.6, RPE
 * log 3.7) calls `enqueue()` instead of writing to Supabase directly.
 *
 * `enqueue()` commits the item to `AsyncStorage` before returning; the
 * network attempt happens afterwards, in the background, and never blocks
 * the caller (product spec §13).
 */

type QueueItemKind = 'daily_checkin' | 'body_map_entry' | 'rpe_log';

/**
 * Payload shape per kind: the row to write, minus `id`/`created_at` — the
 * queue generates `id` itself so retries can safely upsert on it (see
 * `KIND_CONFIG` below) instead of risking a duplicate row if a prior attempt
 * actually succeeded server-side but its response was lost.
 *
 * Domain timestamps (`daily_checkins.date`, `rpe_logs.logged_at`) are left in
 * the payload rather than defaulted — the consumer ticket must set these to
 * the capture-time value, not sync time, since a queued item can sit offline
 * for a while before actually reaching the table.
 */
type QueueItemPayload<K extends QueueItemKind> = K extends 'daily_checkin'
  ? Omit<Database['public']['Tables']['daily_checkins']['Insert'], 'id' | 'created_at'>
  : K extends 'body_map_entry'
    ? Omit<Database['public']['Tables']['body_map_entries']['Insert'], 'id' | 'created_at'>
    : Omit<Database['public']['Tables']['rpe_logs']['Insert'], 'id'>;

type QueueItem = {
  id: string;
  kind: QueueItemKind;
  payload: Record<string, unknown>;
  createdAt: string;
};

/**
 * `daily_checkins` carries the locked `unique(profile_id, date)` constraint
 * (CODING_PLAN.md), so upserting on it is what makes last-write-wins correct
 * for a same-day re-submit. `body_map_entries` and `rpe_logs` are append-only
 * by design — upserting on `id` there only guards against a duplicate insert
 * from a retried-but-already-successful write, not a business dedupe.
 */
const KIND_CONFIG: Record<QueueItemKind, { table: 'daily_checkins' | 'body_map_entries' | 'rpe_logs'; conflictTarget: string }> = {
  daily_checkin: { table: 'daily_checkins', conflictTarget: 'profile_id,date' },
  body_map_entry: { table: 'body_map_entries', conflictTarget: 'id' },
  rpe_log: { table: 'rpe_logs', conflictTarget: 'id' },
};

const STORAGE_PREFIX = '@tulla/offline-queue/';
const RETRY_DELAYS_MS = [2000, 10000, 60000];

/**
 * In-flight retry timers, keyed by item id — cleared/replaced on re-entry so
 * a reconnect-triggered drain doesn't double-schedule a retry already
 * pending from an earlier attempt. The attempt count itself lives only in
 * `syncItem`'s call stack (not persisted): a fresh app open or reconnect
 * starts a new 3-attempt cycle over whatever's still in storage.
 */
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

/* -------------------------------------------------------------------------- */
/* Pending-count store — backs useSyncStatus()                                */
/* -------------------------------------------------------------------------- */

let pendingCount = 0;
const listeners = new Set<() => void>();

function setPendingCount(count: number) {
  if (count === pendingCount) return;
  pendingCount = count;
  for (const listener of listeners) listener();
}

export function subscribePendingCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingCount(): number {
  return pendingCount;
}

async function refreshPendingCount() {
  setPendingCount(await countQueuedItems());
}

/* -------------------------------------------------------------------------- */
/* Per-item sync status — backs useItemSyncStatus()                           */
/* -------------------------------------------------------------------------- */

/**
 * `pendingCount` above answers "is anything in the queue at all" (used by
 * the generic `<SyncIndicator/>`). This answers a different question a
 * specific screen needs: "is *this* row I just wrote actually in the DB
 * yet, or still local?" — three real states, not the same "saved" label
 * whether it's on-device only or confirmed synced (a UI review caught this
 * conflation — "saved on device" read as if it meant "saved to the DB").
 *
 * `pending`: written locally, no sync attempt in flight right now (offline,
 * or waiting on a retry backoff timer). `syncing`: a Supabase call is
 * actually in flight for it right now. Absent from this map entirely means
 * synced — either this item's upsert already succeeded and it was removed,
 * or the id was never enqueued this session at all (e.g. a row fetched
 * fresh from the server), which is equally "already in the DB" for a
 * caller that only ever asks about ids it owns.
 */
type ItemSyncState = 'pending' | 'syncing';
const itemStates = new Map<string, ItemSyncState>();
const itemListeners = new Map<string, Set<() => void>>();

function setItemState(id: string, state: ItemSyncState | null) {
  if (state === null) itemStates.delete(id);
  else itemStates.set(id, state);
  for (const listener of itemListeners.get(id) ?? []) listener();
}

export function subscribeItemSync(id: string, listener: () => void): () => void {
  let set = itemListeners.get(id);
  if (!set) {
    set = new Set();
    itemListeners.set(id, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) itemListeners.delete(id);
  };
}

export function getItemSync(id: string): ItemSyncState | 'synced' {
  return itemStates.get(id) ?? 'synced';
}

/* -------------------------------------------------------------------------- */
/* Storage helpers                                                            */
/* -------------------------------------------------------------------------- */

async function queuedKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(STORAGE_PREFIX));
}

async function countQueuedItems(): Promise<number> {
  return (await queuedKeys()).length;
}

async function readQueuedItems(): Promise<QueueItem[]> {
  const keys = await queuedKeys();
  if (keys.length === 0) return [];
  const entries = await AsyncStorage.multiGet(keys);
  return entries
    .map(([, value]) => (value ? (JSON.parse(value) as QueueItem) : null))
    .filter((item): item is QueueItem => item !== null);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns the item's id — the same value written to the row's own `id`
 * column (see below), so a caller that wants to track this specific
 * submission's sync status (not just "is anything pending") can pass it
 * straight to `useItemSyncStatus()`.
 */
export async function enqueue<K extends QueueItemKind>(kind: K, payload: QueueItemPayload<K>): Promise<string> {
  const item: QueueItem = {
    id: Crypto.randomUUID(),
    kind,
    payload: { ...payload, id: undefined } as Record<string, unknown>,
    createdAt: new Date().toISOString(),
  };
  item.payload.id = item.id;

  // Local write commits before anything else — the caller's submit is done
  // the moment this resolves, regardless of network state.
  await AsyncStorage.setItem(STORAGE_PREFIX + item.id, JSON.stringify(item));
  setItemState(item.id, 'pending');
  await refreshPendingCount();

  // Fire-and-forget: never block the caller on network.
  void syncItem(item);

  return item.id;
}

/**
 * Call once at app root. Sets up the reconnect listener and drains whatever
 * survived from the previous session (product spec §13 — a final-failure
 * item stays queued for "the next app open").
 */
export function initOfflineQueue(): () => void {
  void refreshPendingCount();
  void drainQueue();

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) void drainQueue();
  });

  return unsubscribe;
}

async function drainQueue() {
  const items = await readQueuedItems();
  for (const item of items) void syncItem(item);
}

/* -------------------------------------------------------------------------- */
/* Sync engine                                                                 */
/* -------------------------------------------------------------------------- */

async function syncItem(item: QueueItem, attempt = 0): Promise<void> {
  const existing = retryTimers.get(item.id);
  if (existing) {
    clearTimeout(existing);
    retryTimers.delete(item.id);
  }

  setItemState(item.id, 'syncing');

  const { table, conflictTarget } = KIND_CONFIG[item.kind];
  // Generic upsert across differently-shaped tables — the per-kind payload
  // type already constrains what callers can pass into `enqueue()`.
  const { error } = await (supabase.from(table) as any).upsert(item.payload, { onConflict: conflictTarget });

  if (!error) {
    await AsyncStorage.removeItem(STORAGE_PREFIX + item.id);
    setItemState(item.id, null); // untracked = synced
    await refreshPendingCount();
    return;
  }

  // Back to "pending" — no attempt is actually in flight while we're
  // between retries (or out of them for this session).
  setItemState(item.id, 'pending');

  const nextAttempt = attempt + 1;

  if (nextAttempt >= RETRY_DELAYS_MS.length) {
    Sentry.captureMessage(`offline-queue: final sync failure for kind "${item.kind}"`, {
      level: 'error',
      extra: { kind: item.kind, itemId: item.id, error: error.message },
    });
    // Item stays in AsyncStorage — next app open or reconnect starts a fresh cycle.
    return;
  }

  const delay = RETRY_DELAYS_MS[attempt];
  const timer = setTimeout(() => void syncItem(item, nextAttempt), delay);
  retryTimers.set(item.id, timer);
}
