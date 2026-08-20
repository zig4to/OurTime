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
