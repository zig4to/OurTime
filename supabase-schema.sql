-- Run once in the Supabase dashboard: Database > SQL Editor > New query > Run.
--
-- Generic key-value table backing the shared calendar's "avail:*" entries.
-- Keeping it key/value (instead of a dedicated `iso`/`name` columns table)
-- means the app's existing encodeEntry/decodeEntry logic and storage calls
-- in skupni-koledar.jsx don't need to change at all -- only the storage
-- shim in index.html swaps from localStorage to this table.

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table kv_store enable row level security;

-- Table-level privileges are a separate layer from the RLS policies below:
-- policies decide *which rows* are visible, but the API role still needs
-- the base grant or every request fails with "permission denied for table".
-- The project has "Automatically expose new tables" turned off (which is
-- what would otherwise issue this grant implicitly), so it's explicit here.
grant select, insert, update, delete on table kv_store to anon;

-- Policies are scoped to the "avail:" prefix rather than the whole table,
-- so any other key namespace added later isn't public by default.
create policy "public read avail" on kv_store
  for select using (key like 'avail:%');

create policy "public insert avail" on kv_store
  for insert with check (key like 'avail:%');

create policy "public update avail" on kv_store
  for update using (key like 'avail:%') with check (key like 'avail:%');

create policy "public delete avail" on kv_store
  for delete using (key like 'avail:%');

-- Live updates -------------------------------------------------------------
-- Publishing the table over Realtime is what makes its row changes reach
-- subscribed browsers at all, so a save in one shows up in the others
-- without a reload. This is a separate switch from the policies above: the
-- SELECT policy still decides who is allowed to receive a given row.
--
-- Wrapped because "add table" errors if the table is already published, and
-- this file is meant to survive being run a second time.
do $$
begin
  alter publication supabase_realtime add table kv_store;
exception
  when duplicate_object then null;
end $$;

-- Send the whole pre-change row rather than just the primary key on update
-- and delete. The key alone would technically do here (it *is* the primary
-- key), but this keeps delete payloads self-describing, and the table is far
-- too small for the extra write-ahead log volume to matter.
alter table kv_store replica identity full;
