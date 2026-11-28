-- ======================================================================
-- Gestionale TC Sistem – ticket pianificati nel calendario Microsoft 365
-- Quando un ticket ha data (e ora) di intervento, la funzione wx-cal crea o
-- aggiorna l'appuntamento nel calendario condiviso; se la data viene tolta o il
-- ticket cancellato, l'appuntamento viene eliminato.
-- Da eseguire dopo assistenza.sql e ticket-tecnici.sql. Si può rieseguire.
-- ======================================================================

alter table public.wx_ticket add column if not exists ora_intervento time;
alter table public.wx_ticket add column if not exists durata_min int not null default 60;
alter table public.wx_ticket add column if not exists evento_id text;
alter table public.wx_ticket add column if not exists evento_stato text not null default '';

insert into public.wx_segreti values ('cal_hook', encode(gen_random_bytes(24), 'hex')) on conflict (chiave) do nothing;

create or replace function public.wx_ticket_calendario() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare corpo jsonb;
begin
  if tg_op = 'DELETE' then
    if old.evento_id is null then return old; end if;
    corpo := jsonb_build_object('azione', 'cancella', 'evento_id', old.evento_id);
  else
    corpo := jsonb_build_object('azione', 'sincronizza', 'ticket', new.id);
  end if;
  perform net.http_post(
    url := 'https://unytdhjxgbspchydgure.supabase.co/functions/v1/wx-cal',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-segreto', (select valore from public.wx_segreti where chiave = 'cal_hook')),
    body := corpo);
  if tg_op = 'DELETE' then return old; end if;
  return new;
exception when others then
  if tg_op = 'DELETE' then return old; end if;
  return new;  -- il calendario non deve mai bloccare il ticket
end $$;

drop trigger if exists wx_trg_ticket_cal_ins on public.wx_ticket;
create trigger wx_trg_ticket_cal_ins after insert on public.wx_ticket
  for each row when (new.data_intervento is not null)
  execute function public.wx_ticket_calendario();

-- solo quando cambia qualcosa che si vede nell'appuntamento (non evento_id/evento_stato, per non girare a vuoto)
drop trigger if exists wx_trg_ticket_cal_upd on public.wx_ticket;
create trigger wx_trg_ticket_cal_upd after update on public.wx_ticket
  for each row when (
    old.data_intervento is distinct from new.data_intervento or old.ora_intervento is distinct from new.ora_intervento or
    old.durata_min is distinct from new.durata_min or old.tecnico is distinct from new.tecnico or old.stato is distinct from new.stato or
    old.oggetto is distinct from new.oggetto or old.cliente is distinct from new.cliente or old.indirizzo is distinct from new.indirizzo or
    old.priorita is distinct from new.priorita)
  execute function public.wx_ticket_calendario();

drop trigger if exists wx_trg_ticket_cal_del on public.wx_ticket;
create trigger wx_trg_ticket_cal_del after delete on public.wx_ticket
  for each row execute function public.wx_ticket_calendario();

revoke execute on function public.wx_ticket_calendario() from public;

-- l'app dei tecnici vede anche l'ora dell'intervento
create or replace function public.rap_ticket_lista(pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.rap_pin_ok(pin) then raise exception 'PIN non valido'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', t.id, 'numero', t.numero, 'stato', t.stato, 'priorita', t.priorita, 'cliente', t.cliente,
      'richiedente', t.richiedente, 'telefono', t.telefono, 'email', t.email, 'indirizzo', t.indirizzo, 'oggetto', t.oggetto,
      'descrizione', t.descrizione, 'tecnico', t.tecnico, 'data_intervento', t.data_intervento,
      'ora_intervento', to_char(t.ora_intervento, 'HH24:MI'),
      'rapportino', t.rapportino, 'created_at', t.created_at)
      order by (t.stato = 'Chiuso'), case t.priorita when 'Urgente' then 0 when 'Alta' then 1 when 'Normale' then 2 else 3 end, t.created_at)
    from public.wx_ticket t
    where t.stato <> 'Chiuso' or t.chiuso_at > now() - interval '7 days'), '[]'::jsonb);
end $$;
