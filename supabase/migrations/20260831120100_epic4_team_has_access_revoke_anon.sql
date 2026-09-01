-- Advisor: team_has_access was callable by the unauthenticated `anon` role
-- via PostgREST — being callable by `authenticated` is intentional (4.8/4.10
-- read it from the client), but an anonymous caller has no business probing
-- team/access pairs at all.
revoke execute on function public.team_has_access (uuid)
from anon;
