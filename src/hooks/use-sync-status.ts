import { useSyncExternalStore } from 'react';

import { getPendingCount, subscribePendingCount } from '@/lib/offline-queue';

/**
 * Pending offline-queue item count (plan 2.1). Backs `<SyncIndicator/>`;
 * a consumer screen (3.4, 3.6, 3.7) can also read it directly if it needs
 * the raw count rather than the indicator UI.
 */
export function useSyncStatus(): { pendingCount: number } {
  const pendingCount = useSyncExternalStore(subscribePendingCount, getPendingCount, () => 0);
  return { pendingCount };
}
