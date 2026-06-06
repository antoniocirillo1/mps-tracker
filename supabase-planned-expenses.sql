create table if not exists public.planned_expenses (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  amount numeric(10, 2) not null,
  day_of_month integer not null check (day_of_month between 1 and 31),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists planned_expenses_day_of_month_idx
on public.planned_expenses (day_of_month asc);
