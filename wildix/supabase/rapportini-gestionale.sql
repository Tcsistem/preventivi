-- ======================================================================
-- Gestionale TC Sistem – i rapportini dei tecnici dentro il gestionale
-- Gli utenti del gestionale (wx_utenti) vedono e correggono i rapportini con il
-- loro accesso, senza la password della vecchia dashboard.
-- Si può rieseguire senza perdere dati. Non cambia nulla per l'app dei tecnici.
-- ======================================================================

-- proforma creata in Fatture in Cloud a partire dal rapportino
alter table public.rapportini add column if not exists proforma jsonb;

drop policy if exists wx_rapportini_lettura on public.rapportini;
create policy wx_rapportini_lettura on public.rapportini for select to authenticated using (public.wx_is_utente());
drop policy if exists wx_rapportini_modifica on public.rapportini;
create policy wx_rapportini_modifica on public.rapportini for update to authenticated using (public.wx_is_utente()) with check (public.wx_is_utente());
grant select, update on public.rapportini to authenticated;
