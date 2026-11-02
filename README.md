# Preventivi TCS

Web app per le offerte TCS: sostituisce il file Excel `Prototipo_prev_con_import_clienti` con le stesse regole di calcolo.

- **Offerta**: righe (U.M., descrizione, quantità, materiale unitario a noi, ore, persone), A misura / A corpo, quadro conti (costi a noi, costi con ricarico, totale preventivo, guadagno), trasferta, condizioni di fornitura.
- **Stampa**: anteprima A4 con le sole righe compilate + pagina condizioni e clausole; stampa o PDF dalla finestra del browser.
- **Archivio**: tutte le offerte, con stato e chi le ha create o modificate per ultimo.
- **Clienti**: import da `ELENCO_CLIENTI.xls`, export `an_clienti` del gestionale o CSV.
- **Impostazioni**: ricarichi, tariffe, diaria, oneri, elenchi (pagamenti, U.M., fatturazione, personale), intestazione azienda. Protette da una password unica (controllata dal database); la stessa password sblocca i parametri dentro la singola offerta.

Sito statico (GitHub Pages) + database Supabase (progetto dei rapportini TCS, tabelle `prev_*`) con accesso per utente.

## Messa in funzione

I preventivi stanno **dentro il progetto Supabase dei rapportini TCS** (il piano gratuito ammette solo 2 progetti). Non toccano nulla dei rapportini: tabelle e funzioni hanno il prefisso `prev_`, nessuna impostazione di Auth va cambiata, e i dati li vede solo chi è abilitato in `prev_utenti`.

1. **Database**: nel progetto TCS → SQL Editor → New query → incolla `supabase/schema.sql` → Run.
2. **Link di recupero password**: Authentication → URL Configuration → *Redirect URLs* → aggiungi `https://tcsistem.github.io/preventivi/**`. **Non cambiare la Site URL** (serve ai rapportini).
3. **Chiavi**: Project Settings → API → *Project URL* e chiave *anon public* in `js/config.js` (sono le stesse dei rapportini TCS).
4. **Utenti**:
   - se la persona non ha ancora un login nel progetto: Authentication → Users → *Add user* → *Create new user* (email + password provvisoria, *Auto Confirm User* attivo);
   - poi abilitala ai preventivi (SQL Editor):
     ```sql
     insert into prev_utenti (email, nome) values ('nome@dominio.it', 'Nome')
     on conflict (email) do update set nome = excluded.nome, attivo = true;
     ```
   - per togliere l'accesso: `update prev_utenti set attivo = false where email = 'nome@dominio.it';`
5. **Password impostazioni**: al primo accesso apri la scheda Impostazioni e scegli la password (minimo 4 caratteri).

Password impostazioni dimenticata: SQL Editor → `update prev_impostazioni set pwd_hash = null where id = 1;` e se ne sceglie una nuova dalla scheda.

La chiave *anon* è pubblica per natura: senza login, o con un login non abilitato in `prev_utenti`, il database non restituisce nulla (Row Level Security).

## Calcoli (come il foglio "Offerta (2)")

Per ogni riga: materiale a noi = mat. unit. × q.tà; fornitura (unitario cliente) = mat. unit. × (1 + ricarico materiale); manodopera interna = ore × persone × €/h interno; manodopera cliente = ore × persone × €/h cliente; totale riga = fornitura × q.tà + manodopera cliente; posa (unitario) = manodopera cliente / q.tà.

Giorni totali = ore totali / 8; personale medio = media delle persone, arrotondata per eccesso.
Trasferta a noi = (diaria + vitto) × giorni × personale impiegato; al cliente = (diaria + vitto ricaricato) × giorni × personale medio.
Totale stampato = somma righe + oneri della sicurezza (3%).
