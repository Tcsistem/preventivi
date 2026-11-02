-- =====================================================================
-- Preventivi TCS — schema del database
-- Pensato per stare DENTRO un progetto Supabase già esistente (es. quello
-- dei rapportini TCS) senza toccarne nulla:
--   * tutte le tabelle e funzioni hanno il prefisso prev_
--   * nessun trigger su auth.users, nessuna modifica alle impostazioni di Auth
--   * entra solo chi è nella tabella prev_utenti (gli altri utenti del
--     progetto, es. i tecnici dei rapportini, non vedono nulla)
-- Da eseguire: Supabase > SQL Editor > New query > incolla > Run.
-- Si può rieseguire senza perdere dati.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Utenti abilitati ai preventivi (per email) e nome mostrato nell'app
-- ---------------------------------------------------------------------
create table if not exists public.prev_utenti (
  email      text primary key check (email = lower(email)),
  nome       text not null default '',
  attivo     boolean not null default true,
  user_id    uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- vero se chi sta chiamando è un utente abilitato
create or replace function public.prev_is_utente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.prev_utenti
    where attivo and email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

-- chiamata dall'app a ogni accesso: collega l'utente di login alla sua riga
create or replace function public.prev_registra_accesso()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.prev_is_utente() then return false; end if;
  update public.prev_utenti set user_id = auth.uid()
   where email = lower(auth.jwt()->>'email') and (user_id is distinct from auth.uid());
  return true;
end $$;

-- ---------------------------------------------------------------------
-- Clienti
-- ---------------------------------------------------------------------
create table if not exists public.prev_clienti (
  id         uuid primary key default gen_random_uuid(),
  rs         text not null,               -- ragione sociale
  ind        text not null default '',    -- indirizzo
  cap        text not null default '',
  citta      text not null default '',
  prov       text not null default '',
  piva       text not null default '',
  cf         text not null default '',
  email      text not null default '',
  pec        text not null default '',
  sdi        text not null default '',
  ref        text not null default '',    -- referente / cortese attenzione
  tel        text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prev_clienti_rs_idx   on public.prev_clienti (lower(rs));
create index if not exists prev_clienti_piva_idx on public.prev_clienti (piva) where piva <> '';

-- ---------------------------------------------------------------------
-- Offerte
-- ---------------------------------------------------------------------
create table if not exists public.prev_offerte (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null unique,          -- es. 2026/012
  data            date not null default current_date,
  stato           text not null default 'Bozza' check (stato in ('Bozza','Inviata','Accettata','Persa')),
  cliente_id      uuid references public.prev_clienti(id) on delete set null,
  cliente         text not null default '',
  cliente_blocco  text not null default '',
  attenzione      text not null default '',
  redatto         text not null default '',
  responsabile    text not null default '',
  oggetto         text not null default '',
  modalita        text not null default 'misura' check (modalita in ('misura','corpo')),
  trasferta       boolean not null default false,
  parametri       jsonb not null default '{}'::jsonb,
  righe           jsonb not null default '[]'::jsonb,
  condizioni      jsonb not null default '{}'::jsonb,
  tot_offerta     numeric(14,2) not null default 0,
  tot_preventivo  numeric(14,2) not null default 0,
  guadagno        numeric(14,2) not null default 0,
  created_by      uuid default auth.uid() references public.prev_utenti(user_id) on delete set null,
  updated_by      uuid default auth.uid() references public.prev_utenti(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists prev_offerte_updated_idx on public.prev_offerte (updated_at desc);
create index if not exists prev_offerte_cliente_idx on public.prev_offerte (cliente_id);

-- ---------------------------------------------------------------------
-- Impostazioni (una riga) + password che le protegge (solo hash)
-- ---------------------------------------------------------------------
create table if not exists public.prev_impostazioni (
  id         int primary key default 1 check (id = 1),
  dati       jsonb not null default '{}'::jsonb,
  pwd_hash   text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
insert into public.prev_impostazioni (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- updated_at / updated_by automatici
-- ---------------------------------------------------------------------
create or replace function public.prev_tocca()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.prev_tocca_autore()
returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by); return new; end $$;

drop trigger if exists prev_trg_clienti on public.prev_clienti;
create trigger prev_trg_clienti before update on public.prev_clienti for each row execute function public.prev_tocca();
drop trigger if exists prev_trg_offerte on public.prev_offerte;
create trigger prev_trg_offerte before update on public.prev_offerte for each row execute function public.prev_tocca_autore();
drop trigger if exists prev_trg_impostazioni on public.prev_impostazioni;
create trigger prev_trg_impostazioni before update on public.prev_impostazioni for each row execute function public.prev_tocca_autore();

-- ---------------------------------------------------------------------
-- Prossimo numero offerta dell'anno (es. 2026/013)
-- ---------------------------------------------------------------------
create or replace function public.prev_prossimo_numero(anno int default extract(year from current_date)::int)
returns text language sql stable as $$
  select anno::text || '/' || lpad((coalesce(max(nullif(split_part(numero, '/', 2), '')::int), 0) + 1)::text, 3, '0')
  from public.prev_offerte
  where numero ~ ('^' || anno::text || '/[0-9]+$');
$$;

-- ---------------------------------------------------------------------
-- Password delle impostazioni
-- ---------------------------------------------------------------------
create or replace function public.prev_impostazioni_protette()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.prev_is_utente() and (select pwd_hash is not null from public.prev_impostazioni where id = 1);
$$;

create or replace function public.prev_verifica_password_impostazioni(pwd text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare h text;
begin
  if not public.prev_is_utente() then return false; end if;
  select pwd_hash into h from public.prev_impostazioni where id = 1;
  return h is not null and crypt(coalesce(pwd, ''), h) = h;
end $$;

create or replace function public.prev_imposta_password_impostazioni(vecchia text, nuova text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if not public.prev_is_utente() then raise exception 'Utente non abilitato' using errcode = '42501'; end if;
  if length(coalesce(nuova, '')) < 4 then raise exception 'La password deve avere almeno 4 caratteri' using errcode = '22023'; end if;
  select pwd_hash into h from public.prev_impostazioni where id = 1;
  if h is not null and crypt(coalesce(vecchia, ''), h) <> h then
    raise exception 'Password errata' using errcode = '28P01';
  end if;
  update public.prev_impostazioni set pwd_hash = crypt(nuova, gen_salt('bf')) where id = 1;
end $$;

create or replace function public.prev_salva_impostazioni(pwd text, nuovi jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.prev_verifica_password_impostazioni(pwd) then
    raise exception 'Password errata' using errcode = '28P01';
  end if;
  update public.prev_impostazioni set dati = coalesce(nuovi, '{}'::jsonb) where id = 1;
end $$;

-- ---------------------------------------------------------------------
-- Sicurezza (RLS): solo gli utenti abilitati in prev_utenti
-- ---------------------------------------------------------------------
alter table public.prev_utenti       enable row level security;
alter table public.prev_clienti      enable row level security;
alter table public.prev_offerte      enable row level security;
alter table public.prev_impostazioni enable row level security;

drop policy if exists prev_utenti_lettura on public.prev_utenti;
create policy prev_utenti_lettura on public.prev_utenti for select to authenticated using (public.prev_is_utente());
drop policy if exists prev_utenti_proprio on public.prev_utenti;
create policy prev_utenti_proprio on public.prev_utenti for update to authenticated
  using (public.prev_is_utente() and user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists prev_clienti_tutto on public.prev_clienti;
create policy prev_clienti_tutto on public.prev_clienti for all to authenticated
  using (public.prev_is_utente()) with check (public.prev_is_utente());

drop policy if exists prev_offerte_tutto on public.prev_offerte;
create policy prev_offerte_tutto on public.prev_offerte for all to authenticated
  using (public.prev_is_utente()) with check (public.prev_is_utente());

drop policy if exists prev_impostazioni_lettura on public.prev_impostazioni;
create policy prev_impostazioni_lettura on public.prev_impostazioni for select to authenticated using (public.prev_is_utente());

revoke all on public.prev_utenti, public.prev_clienti, public.prev_offerte, public.prev_impostazioni from anon, authenticated;
grant select on public.prev_utenti to authenticated;
grant update (nome) on public.prev_utenti to authenticated;                       -- ognuno cambia solo il proprio nome
grant select, insert, update, delete on public.prev_clienti, public.prev_offerte to authenticated;
grant select (id, dati, updated_at, updated_by) on public.prev_impostazioni to authenticated;   -- l'hash resta nascosto

revoke execute on function public.prev_is_utente(), public.prev_registra_accesso(), public.prev_prossimo_numero(int),
  public.prev_impostazioni_protette(), public.prev_verifica_password_impostazioni(text),
  public.prev_imposta_password_impostazioni(text, text), public.prev_salva_impostazioni(text, jsonb) from public, anon;
grant execute on function public.prev_is_utente(), public.prev_registra_accesso(), public.prev_prossimo_numero(int),
  public.prev_impostazioni_protette(), public.prev_verifica_password_impostazioni(text),
  public.prev_imposta_password_impostazioni(text, text), public.prev_salva_impostazioni(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- UTENTI ABILITATI: una riga per ogni persona che deve usare i preventivi.
-- L'email deve essere quella con cui entra (utente in Authentication > Users).
-- Togli i trattini davanti e cambia le email, poi esegui di nuovo.
-- ---------------------------------------------------------------------
-- insert into public.prev_utenti (email, nome) values
--   ('claudio@esempio.it', 'Claudio'),
--   ('collega@esempio.it', 'Nome Collega')
-- on conflict (email) do update set nome = excluded.nome, attivo = true;
