-- =====================================================================
-- Gestionale TC Sistem — modulo ASSISTENZA (ticket / richieste di intervento)
-- Da eseguire dopo schema.sql. Si può rieseguire senza perdere dati.
-- =====================================================================

create table if not exists public.wx_ticket (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,                 -- es. T001-26
  stato            text not null default 'Nuovo' check (stato in ('Nuovo','In carico','Pianificato','In attesa cliente','Chiuso')),
  priorita         text not null default 'Normale' check (priorita in ('Bassa','Normale','Alta','Urgente')),
  canale           text not null default 'manuale',      -- manuale, chat interna, chat cliente, whatsapp, email
  cliente_id       uuid references public.wx_clienti(id) on delete set null,
  cliente          text not null default '',
  richiedente      text not null default '',
  telefono         text not null default '',
  email            text not null default '',
  indirizzo        text not null default '',
  oggetto          text not null default '',
  descrizione      text not null default '',
  tecnico          text not null default '',
  data_intervento  date,
  note_interne     text not null default '',
  storico          jsonb not null default '[]'::jsonb,   -- [{quando, chi, testo}]
  email_message_id text unique,                          -- per non creare due ticket dalla stessa email
  rapportino       text not null default '',             -- numero del rapportino collegato
  chiuso_at        timestamptz,
  created_by       uuid default auth.uid(),
  updated_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists wx_ticket_stato_idx on public.wx_ticket (stato, created_at desc);

drop trigger if exists wx_trg_ticket on public.wx_ticket;
create trigger wx_trg_ticket before update on public.wx_ticket for each row execute function public.wx_tocca_autore();

-- prossimo numero ticket dell'anno: T001-26, T002-26, …
create or replace function public.wx_prossimo_ticket(anno int default extract(year from current_date)::int)
returns text language sql stable as $$
  select 'T' || lpad((coalesce(max(substring(numero from '^T([0-9]+)-')::int), 0) + 1)::text, 3, '0') || '-' || right(anno::text, 2)
  from public.wx_ticket
  where numero ~ ('^T[0-9]+-' || right(anno::text, 2) || '$');
$$;

alter table public.wx_ticket enable row level security;
drop policy if exists wx_ticket_tutto on public.wx_ticket;
create policy wx_ticket_tutto on public.wx_ticket for all to authenticated
  using (public.wx_is_utente()) with check (public.wx_is_utente());
revoke all on public.wx_ticket from anon, authenticated;
grant select, insert, update, delete on public.wx_ticket to authenticated;
revoke execute on function public.wx_prossimo_ticket(int) from public, anon;
grant execute on function public.wx_prossimo_ticket(int) to authenticated;

-- elenco tecnici (tabella "operai" dei rapportini) leggibile dagli utenti del gestionale
do $$ begin
  if to_regclass('public.operai') is not null then
    execute 'drop policy if exists wx_operai_lettura on public.operai';
    execute 'create policy wx_operai_lettura on public.operai for select to authenticated using (public.wx_is_utente())';
    execute 'grant select on public.operai to authenticated';
  end if;
end $$;
