# TC Sistem Preventivi (preventivatore Wildix e materiali)

Web app per fare offerte Wildix e non Wildix, con stampa/PDF per il cliente e analisi interna di costi e margini.

Indirizzo: **https://tcsistem.github.io/preventivi/wildix/**

## Cosa fa

- **Offerta**: cerchi gli articoli nei listini Wildix Gold **Capex**, **Opex** (HWaaS, licenze a canone) e **CLASSOUND** (DID, flat, eSIM), oppure aggiungi **righe libere** per prodotti di altri marchi e servizi.
  - Costo a me = prezzo Gold; listino = prezzo End User.
  - Sulle righe di listino imposti uno **sconto %** sul listino, sulle righe libere un **ricarico %** sul costo, oppure scrivi direttamente il prezzo. Pulsanti per applicare sconto o ricarico a tutte le righe in un colpo.
  - Per gli articoli Opex a scaglioni (1-5, 6-50, 51-200…) la **fascia di prezzo si sceglie da sola** in base alla quantità.
  - Ogni riga ha la sua periodicità (una tantum, mensile, annuale, 5 anni): i totali si separano da soli.
  - Titoli di sezione per raggruppare le righe.
- **Costi a me** (mai stampati sull'offerta): ore di installazione, trasferte, canoni dei fornitori, provvigioni… con voci rapide configurabili. Il quadro economico mostra ricavo, costo e margine per periodo e il **margine del primo anno**.
- **Anteprima / PDF**: foglio A4 per il cliente (scegli se mostrare codici, prezzi unitari, listino e sconto, descrizioni originali in inglese). “Stampa / Salva PDF” → nella finestra di stampa scegli *Salva come PDF*.
- **Stampa costi interni**: foglio A4 con costi, ricavi e margini riga per riga, marcato “documento interno”.
- **Materiali**: database dei materiali e servizi di uso comune (anche non Wildix) con codice, marca, categoria, U.M., costo e prezzo (senza prezzo si applica il ricarico predefinito). Inserimento manuale, import da Excel/CSV (`codice, descrizione, categoria, marca, um, costo, prezzo, periodo`; stesso codice = aggiornamento), export CSV, e pulsante 💾 per salvare una riga libera dell'offerta.
- **Archivio**, **Clienti** (anche import CSV), **Listini Wildix** (versioni), **Impostazioni** (intestazione con logo, sconti e condizioni predefinite).

Le offerte copiano dentro di sé i prezzi: quando carichi un listino nuovo, le offerte vecchie non cambiano.

## Messa in funzione (una volta)

Il preventivatore si installa **dentro un progetto Supabase che già usi** (es. quello dei rapportini TC Sistem o TCS): tabelle e funzioni hanno il prefisso `wx_` e non toccano nulla del resto. Vedono i dati solo gli utenti abilitati in `wx_utenti`.

1. **Database**: Supabase → SQL Editor → New query → incolla `wildix/supabase/schema.sql` → Run.
2. **Chiavi**: Project Settings → API → copia *Project URL* e chiave *anon public* in `wildix/js/config.js`.
3. **Link per il recupero password**: Authentication → URL Configuration → *Redirect URLs* → aggiungi `https://tcsistem.github.io/preventivi/wildix/**`. Non cambiare la Site URL.
4. **Utenti**:
   - se la persona non ha ancora un login nel progetto: Authentication → Users → *Add user* (email + password, *Auto Confirm User* attivo);
   - abilitala (SQL Editor):
     ```sql
     insert into wx_utenti (email, nome) values ('claudio@tcsistem.it', 'Claudio')
     on conflict (email) do update set nome = excluded.nome, attivo = true;
     ```
5. **Listino**: entra nell'app → scheda **Listini** → “Carica listino incluso: Novembre 2026”. Sono 1.672 righe (Capex 108, Opex 771, CLASSOUND 793).
6. **Impostazioni**: completa intestazione (indirizzo, P.IVA), logo e condizioni predefinite.

Finché `config.js` ha i segnaposto il sito parte in **modalità prova**: nessun login, dati solo nel browser. Si può forzare con `?prova` in fondo all'indirizzo.

## Aggiornare i listini (ogni mese)

1. Scarica i PDF Gold Capex, Opex e CLASSOUND dal portale Wildix.
2. Converti:
   ```bash
   pip install pdfplumber
   python3 wildix/tools/listino_pdf.py "Dicembre 2026" Gold_Capex*.pdf Gold_Opex*.pdf Gold_CLASSOUND*.pdf -o listino-2026-12.json
   ```
3. Scheda Listini → “Importa file listino (.json)”. Diventa il listino in uso; le versioni vecchie si possono eliminare dalla stessa scheda.

## Calcoli

- Riga: totale = prezzo unitario × quantità; margine = (prezzo − costo) × quantità.
- Prezzo da sconto: listino × (1 − sconto%). Prezzo da ricarico: costo × (1 + ricarico%).
- Per periodo: ricavo, costo (righe + costi interni), margine.
- Primo anno = una tantum + 12 × mensile + annuale + 5 anni (pagati anticipati).

## File

- `index.html`, `css/wx.css` (usa anche `../css/app.css`), `js/app.js`, `js/prova.js`, `js/config.js`
- `data/listino-2026-11.json` — listini Wildix Gold Novembre 2026 estratti dai PDF
- `supabase/schema.sql` — tabelle `wx_*` con Row Level Security
- `tools/listino_pdf.py` — PDF Wildix → file .json da importare

## Assistenza (ticket)

- Tabella `wx_ticket` (script `supabase/assistenza.sql`), numerazione `T001-26`, `T002-26`… che riparte ogni anno.
- Sezione **Assistenza** nel gestionale: elenco con filtri (Aperti, Nuovi, Pianificati, Chiusi), badge con i ticket nuovi, scheda con stato, priorità, tecnico (dall'elenco operai dei rapportini), data intervento, note interne, storico e numero rapportino collegato. Link diretto `#ticket=<id>`.
- Funzione `wx-assist` (Verify JWT disattivato, chiave `WX_BOT_KEY`): azioni `apri_ticket`, `stato_ticket`, `aggiungi_nota`. Il cliente viene riconosciuto lato server (P.IVA, email o ragione sociale); al bot non tornano mai dati di altri clienti.
- Wildix (Wilma): strumenti `apri_ticket` e `stato_ticket` (categoria Assistenza, credenziale wx-bot) e agente **Assistenza TC Sistem** sul canale Chat, con `avvisa_ufficio` per l'avviso nella chat dell'ufficio. L'agente non ha gli strumenti dei preventivi (niente ricerca clienti né listini).

## Ticket nell'app dei tecnici (raptcsistem)

- Script `supabase/ticket-tecnici.sql`: PIN dei tecnici (impostato in Impostazioni del gestionale, salvato cifrato in `wx_segreti`), funzioni `rap_ticket_lista`, `rap_ticket_prendi`, `rap_ticket_rapportino`, `rap_push_registra` (tutte chiedono il PIN), trigger che a ogni nuovo ticket chiama la funzione `rap-push`.
- Funzione `rap-push` (Verify JWT disattivato): genera da sola le chiavi VAPID al primo uso e invia le notifiche push ai telefoni iscritti; l'invio è accettato solo dal trigger (segreto `push_hook`).
- App tecnici (tcsistem.github.io/raptcsistem, stesso indirizzo di sempre): scheda **Ticket** con filtri Aperti / Miei / Da assegnare / Chiusi, "Prendo io", "Fai rapportino" (precompila cliente, indirizzo e descrizione e collega il ticket). Quando il rapportino collegato viene inviato firmato il ticket si chiude; se inviato senza firma il ticket resta aperto con il numero del rapportino. `sw.js` mostra le notifiche anche ad app chiusa (su iPhone l'app va aggiunta alla schermata Home).
- Gestionale: pagina iniziale con Preventivi, Assistenza, Listini e materiali e il collegamento alla dashboard dei rapportini.
