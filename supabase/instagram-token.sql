-- Token de la API de Instagram (Instagram Login) para el widget público /widget/instagram.
-- Tabla de una sola fila: guarda el token de larga duración (60 días) y cuándo se renovó.
-- El widget lo renueva solo cuando tiene más de 7 días, así nunca caduca mientras la web reciba visitas.
-- Ejecutá en Supabase → SQL Editor antes de usar el widget.

create table if not exists public.instagram_token (
  id smallint primary key default 1 check (id = 1),
  access_token text not null,
  refreshed_at timestamptz not null default now()
);

comment on table public.instagram_token is
  'Token de Instagram con scope instagram_business_basic (solo lectura de perfil y posts propios).';

alter table public.instagram_token enable row level security;

drop policy if exists "instagram_token_select_anon" on public.instagram_token;
drop policy if exists "instagram_token_insert_anon" on public.instagram_token;
drop policy if exists "instagram_token_update_anon" on public.instagram_token;

create policy "instagram_token_select_anon"
  on public.instagram_token for select
  to anon
  using (true);

create policy "instagram_token_insert_anon"
  on public.instagram_token for insert
  to anon
  with check (true);

create policy "instagram_token_update_anon"
  on public.instagram_token for update
  to anon
  using (true)
  with check (true);
