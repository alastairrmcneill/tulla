import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';

/**
 * Shared read cache (plan 2.2) — resolves product spec §14's "cached
 * last-known state + retry on every read screen" once, here, instead of
 * each screen reimplementing it.
 *
 * `retry: 2` per screen query. `gcTime` (how long an unused query is kept
 * before eviction, and the ceiling on what the persister can restore) is set
 * well past react-query's 5-minute default — an athlete who opens the app
 * offline after a day away should still see yesterday's cached read, not an
 * empty screen.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      gcTime: 1000 * 60 * 60 * 24, // 24h
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: '@tulla/query-cache',
});

// `<PersistQueryClientProvider>` supplies `queryClient` itself via its own
// `client` prop, so it's deliberately omitted here.
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // matches gcTime — no point persisting past what gcTime would evict anyway
};
