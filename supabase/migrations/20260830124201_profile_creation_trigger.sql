-- Auto-create a profiles row on signup (plan 1.9). A trigger, not a
-- client-side insert call, per the task's own reasoning: can't be skipped
-- by a bug in the client's sign-up flow. Runs as the trigger owner
-- (security definer implicit for triggers on auth.users, which the
-- authenticated/anon roles can't write to directly anyway), so this is
-- the one legitimate path around profiles' own RLS (which has no insert
-- policy at all, by design -- see 1.7).
create function public.handle_new_user () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function public.handle_new_user ();
