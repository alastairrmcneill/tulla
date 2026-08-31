-- Expo push token storage (plan 2.3). Set by the client on permission
-- grant (profiles_update_own already covers this — own row, no RLS change
-- needed). Read by the send-push Edge Function (service role) to address
-- a push; never read back out to another user's client.
alter table profiles
add column expo_push_token text;
