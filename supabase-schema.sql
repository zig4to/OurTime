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

-- Archive photos -----------------------------------------------------------
-- Photos are files, so they live in Storage rather than in kv_store; what
-- kv_store holds is one small row per photo carrying its path. An image
-- inside a row would be pulled by every window query and pushed down the
-- realtime channel on every change, repeatedly and to everyone.
--
-- The size and type limits are not tidiness. Public read plus anon insert
-- with neither one is an open file host on this project's bandwidth: anybody
-- could upload anything, of any size, and serve it from this domain.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arhiv', 'arhiv', true,
  5242880,  -- 5 MB: admits a phone photo, refuses a video. The app scales
            -- images down long before this, so hitting it means something
            -- bypassed the app.
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "arhiv: nalaganje"
  on storage.objects for insert to anon
  with check (bucket_id = 'arhiv');

-- Deliberately no delete policy for anon. Read is public and there is no
-- login, so a delete grant would let any visitor destroy every photo -- and
-- unlike an availability entry, nobody has a second copy to retype it from.
-- Removing a photo from the app deletes its kv_store row, which takes it out
-- of the archive and leaves the file orphaned; purging files is a dashboard
-- job, done by someone who meant to.

-- Push subscriptions -------------------------------------------------------
-- One row per device, under its own "push:" prefix rather than "avail:". Two
-- reasons it is not squeezed into the avail namespace: personFromKey would
-- read the device id as a person and it would surface as a fake name in the
-- calendar, and every window query would carry these rows for no reason.
--
-- All four are granted, select included. Withholding select was tried first,
-- on the reasoning that only the sender reads these and the sender is an Edge
-- Function using service_role, which bypasses RLS anyway. It does not work:
-- RLS row visibility also governs the WHERE clause of update and delete, so
-- an upsert failed outright and -- worse -- a delete matched nothing and
-- reported success, which would have left dead subscriptions in the table
-- forever while the app claimed notifications were off.
--
-- What that would have protected is small in any case. A subscription cannot
-- be used to send anything without the VAPID private key, which is not here,
-- and the names in these rows are already public in the calendar itself. The
-- only thing select exposes is how many devices exist and their endpoint URLs.
create policy "push select" on kv_store
  for select using (key like 'push:%');

create policy "push insert" on kv_store
  for insert with check (key like 'push:%');

create policy "push update" on kv_store
  for update using (key like 'push:%') with check (key like 'push:%');

create policy "push delete" on kv_store
  for delete using (key like 'push:%');
