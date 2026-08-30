-- Same reasoning as 1.7's move_rls_helpers_to_private_schema: no reason
-- for this trigger function to be a public RPC endpoint.
alter function handle_new_user () set schema private;
