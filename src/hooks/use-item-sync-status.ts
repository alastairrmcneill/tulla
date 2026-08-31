import { useSyncExternalStore } from 'react';

import { getItemSync, subscribeItemSync } from '@/lib/offline-queue';

/**
 * Sync status for one specific offline-queue item (plan 2.1 extended — a UI
 * review caught `<SyncIndicator/>`'s global `pendingCount` being reused for
 * "is this exact row saved to the DB yet", which it doesn't actually answer).
 * `id` is whatever `enqueue()` returned for that write.
 */
export function useItemSyncStatus(id: string | null | undefined): 'pending' | 'syncing' | 'synced' {
  return useSyncExternalStore(
    (listener) => (id ? subscribeItemSync(id, listener) : () => {}),
    () => (id ? getItemSync(id) : 'synced'),
    () => 'synced',
  );
}
