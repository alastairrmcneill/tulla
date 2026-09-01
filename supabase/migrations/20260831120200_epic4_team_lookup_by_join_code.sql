-- Addition beyond 4.11's literal task text: the join-code entry screen and
-- the consent screen both need to show a team's name/sport and its coach's
-- name *before* the athlete is a member — but `teams_select_member` (1.7)
-- only lets an existing member read a team's row at all. Without a narrow,
-- security-definer lookup, a prospective joiner can't validate a code or see
-- what they're about to consent to. Exposes only the three non-sensitive
-- fields the consent screen's copy needs — never the join_code itself back,
-- and never anything from team_members/daily_checkins etc.
create function public.team_lookup_by_join_code (p_join_code text) returns table (
  team_id uuid,
  team_name text,
  sport text,
  admin_name text
) language sql stable security definer
set search_path = '' as $$
  select t.id, t.name, t.sport, p.name
  from public.teams t
    join public.team_members tm on tm.team_id = t.id and tm.role = 'admin'
    join public.profiles p on p.id = tm.profile_id
  where t.join_code = upper(p_join_code)
  limit 1;
$$;

revoke execute on function public.team_lookup_by_join_code (text)
from public,
anon;

grant execute on function public.team_lookup_by_join_code (text) to authenticated;
