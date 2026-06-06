create table if not exists public.tracker_settings (
  id text primary key default 'main',
  salary_anchor_date date not null,
  monthly_income numeric(10, 2) not null default 1930,
  savings_goal numeric(10, 2) not null default 300,
  updated_at timestamp with time zone not null default now()
);

insert into public.tracker_settings (
  id,
  salary_anchor_date,
  monthly_income,
  savings_goal
)
values (
  'main',
  current_date,
  1930,
  300
)
on conflict (id) do nothing;
