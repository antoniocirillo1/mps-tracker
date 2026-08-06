-- Tabella per salvare le Web Push subscriptions dei dispositivi
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- Nessuna RLS necessaria: accesso solo lato server tramite service role
-- oppure abilita RLS con policy permissiva se usi anon key:
alter table push_subscriptions enable row level security;

create policy "Allow insert from anon" on push_subscriptions
  for insert with check (true);

create policy "Allow select from anon" on push_subscriptions
  for select using (true);
