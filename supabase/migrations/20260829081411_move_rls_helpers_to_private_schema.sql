-- Advisor: is_team_member/is_team_admin/has_coach_access were directly
-- callable as public RPC endpoints (/rest/v1/rpc/...) by anon and
-- authenticated -- a minor info-leak (a boolean oracle on arbitrary
-- team/profile pairs), not the intended use. PostgREST only exposes
-- functions living in schemas listed in the API config (public,
-- graphql_public by default) -- moving them to a schema outside that list
-- removes the RPC surface entirely.
--
-- This does NOT require touching any existing policy: Postgres binds a
-- policy's USING/CHECK expression to the function's OID at CREATE POLICY
-- time, not to a schema-qualified name re-resolved on every query, so
-- `alter function ... set schema` is transparent to every policy already
-- referencing these functions.
create schema if not exists private;

alter function is_team_member (uuid, uuid) set schema private;

alter function is_team_admin (uuid, uuid) set schema private;

alter function has_coach_access (uuid) set schema private;
