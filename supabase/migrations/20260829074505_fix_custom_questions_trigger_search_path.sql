-- Pin search_path on the trigger function (advisor: function_search_path_mutable).
-- Table reference must be schema-qualified now that search_path is empty.
create or replace function enforce_max_custom_questions ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.custom_questions where team_id = new.team_id) >= 2 then
    raise exception 'A team can have at most 2 custom questions';
  end if;
  return new;
end;
$$;
