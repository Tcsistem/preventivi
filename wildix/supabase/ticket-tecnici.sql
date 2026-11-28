-- ======================================================================
-- Gestionale TC Sistem – ticket di assistenza nell'app dei tecnici (raptcsistem)
-- Da eseguire dopo assistenza.sql. Si può rieseguire senza perdere dati.
--
-- L'app dei tecnici non ha login: usa la chiave pubblica. Per non esporre i
-- ticket (clienti, telefoni, indirizzi) a chiunque abbia quella chiave, ogni
-- funzione chiede il PIN dei tecnici, impostato dall'ufficio nel gestionale.
-- ======================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- segreti interni (PIN, chiavi push): nessuno li legge direttamente
create table if not exists public.wx_segreti (chiave text primary key, valore text not null);
alter table public.wx_segreti enable row level security;
revoke all on public.wx_segreti from anon, authenticated;

-- iscrizioni alle notifiche push dei telefoni dei tecnici
create table if not exists public.rap_push (
  endpoint text primary key, sub jsonb not null, tecnico text not null default '',
  created_at timestamptz not null default now());
alter table public.rap_push enable row level security;
revoke all on public.rap_push from anon, authenticated;

-- l'ufficio imposta il PIN (solo utenti del gestionale)
create or replace function public.wx_imposta_pin_tecnici(pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.wx_is_utente() then raise exception 'Non autorizzato'; end if;
  if length(coalesce(pin,'')) < 6 then raise exception 'Il PIN deve avere almeno 6 caratteri'; end if;
  insert into public.wx_segreti values ('pin_tecnici', encode(digest('tcs:' || pin, 'sha256'), 'hex'))
  on conflict (chiave) do update set valore = excluded.valore;
end $$;
create or replace function public.wx_pin_tecnici_impostato() returns boolean
language sql stable security definer set search_path = public as $$
  select public.wx_is_utente() and exists (select 1 from public.wx_segreti where chiave = 'pin_tecnici');
$$;

create or replace function public.rap_pin_ok(pin text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.wx_segreti where chiave = 'pin_tecnici'
                 and valore = encode(digest('tcs:' || coalesce(pin,''), 'sha256'), 'hex'));
$$;

-- elenco dei ticket per l'app: aperti + chiusi negli ultimi 7 giorni, senza note interne
create or replace function public.rap_ticket_lista(pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.rap_pin_ok(pin) then raise exception 'PIN non valido'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'numero', t.numero, 'stato', t.stato, 'priorita', t.priorita, 'cliente', t.cliente,
      'richiedente', t.richiedente, 'telefono', t.telefono, 'email', t.email, 'indirizzo', t.indirizzo, 'oggetto', t.oggetto,
      'descrizione', t.descrizione, 'tecnico', t.tecnico, 'data_intervento', t.data_intervento,
      'rapportino', t.rapportino, 'created_at', t.created_at)
      order by (t.stato = 'Chiuso'), case t.priorita when 'Urgente' then 0 when 'Alta' then 1 when 'Normale' then 2 else 3 end, t.created_at)
    from public.wx_ticket t
    where t.stato <> 'Chiuso' or t.chiuso_at > now() - interval '7 days'), '[]'::jsonb);
end $$;

-- il tecnico prende in carico il ticket
create or replace function public.rap_ticket_prendi(pin text, ticket uuid, tecnico text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.wx_ticket;
begin
  if not public.rap_pin_ok(pin) then raise exception 'PIN non valido'; end if;
  tecnico := upper(trim(coalesce(tecnico,'')));
  if tecnico = '' then raise exception 'Indica il tecnico'; end if;
  update public.wx_ticket set tecnico = rap_ticket_prendi.tecnico,
      stato = case when stato in ('Nuovo') then 'In carico' else stato end,
      storico = storico || jsonb_build_array(jsonb_build_object('quando', now(), 'chi', rap_ticket_prendi.tecnico, 'testo', 'Preso in carico dall''app rapportini')),
      updated_by = null
    where id = ticket returning * into t;
  if t.id is null then raise exception 'Ticket non trovato'; end if;
  return jsonb_build_object('ok', true, 'numero', t.numero, 'stato', t.stato);
end $$;

-- il rapportino inviato viene collegato al ticket (e, se firmato, lo chiude)
create or replace function public.rap_ticket_rapportino(pin text, ticket uuid, numero text, tecnico text, chiudi boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.wx_ticket;
begin
  if not public.rap_pin_ok(pin) then raise exception 'PIN non valido'; end if;
  update public.wx_ticket set
      rapportino = trim(both ', ' from concat_ws(', ', nullif(rapportino, ''), rap_ticket_rapportino.numero)),
      tecnico = case when coalesce(wx_ticket.tecnico,'') = '' then upper(coalesce(rap_ticket_rapportino.tecnico,'')) else wx_ticket.tecnico end,
      stato = case when chiudi then 'Chiuso' when stato = 'Nuovo' then 'In carico' else stato end,
      chiuso_at = case when chiudi then now() else chiuso_at end,
      storico = storico || jsonb_build_array(jsonb_build_object('quando', now(), 'chi', upper(coalesce(rap_ticket_rapportino.tecnico,'')),
        'testo', 'Rapportino ' || rap_ticket_rapportino.numero || case when chiudi then ' firmato: ticket chiuso' else ' inviato' end)),
      updated_by = null
    where id = ticket returning * into t;
  if t.id is null then raise exception 'Ticket non trovato'; end if;
  return jsonb_build_object('ok', true, 'numero', t.numero, 'stato', t.stato);
end $$;

-- registrazione del telefono per le notifiche
create or replace function public.rap_push_registra(pin text, sub jsonb, tecnico text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.rap_pin_ok(pin) then raise exception 'PIN non valido'; end if;
  if coalesce(sub->>'endpoint','') !~ '^https://' then raise exception 'Iscrizione non valida'; end if;
  insert into public.rap_push (endpoint, sub, tecnico) values (sub->>'endpoint', sub, upper(coalesce(tecnico,'')))
  on conflict (endpoint) do update set sub = excluded.sub, tecnico = excluded.tecnico;
  return jsonb_build_object('ok', true);
end $$;

-- a ogni nuovo ticket parte la notifica ai tecnici (funzione rap-push)
insert into public.wx_segreti values ('push_hook', encode(gen_random_bytes(24), 'hex')) on conflict (chiave) do nothing;
create or replace function public.wx_ticket_notifica() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://unytdhjxgbspchydgure.supabase.co/functions/v1/rap-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-segreto', (select valore from public.wx_segreti where chiave = 'push_hook')),
    body := jsonb_build_object('azione', 'invia', 'ticket', new.id));
  return new;
exception when others then return new;  -- la notifica non deve mai bloccare il ticket
end $$;
drop trigger if exists wx_trg_ticket_notifica on public.wx_ticket;
create trigger wx_trg_ticket_notifica after insert on public.wx_ticket for each row execute function public.wx_ticket_notifica();

revoke execute on function public.wx_imposta_pin_tecnici(text), public.wx_pin_tecnici_impostato(), public.rap_pin_ok(text),
  public.rap_ticket_lista(text), public.rap_ticket_prendi(text, uuid, text), public.rap_ticket_rapportino(text, uuid, text, text, boolean),
  public.rap_push_registra(text, jsonb, text), public.wx_ticket_notifica() from public;
grant execute on function public.wx_imposta_pin_tecnici(text), public.wx_pin_tecnici_impostato() to authenticated;
grant execute on function public.rap_ticket_lista(text), public.rap_ticket_prendi(text, uuid, text),
  public.rap_ticket_rapportino(text, uuid, text, text, boolean), public.rap_push_registra(text, jsonb, text) to anon, authenticated;
