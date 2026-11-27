# Bot richieste d'offerta per i venditori (Wildix AI Chat Agent)

Il venditore scrive al bot in x-bees / Collaboration 7. Il bot raccoglie cliente e articoli, crea nel
preventivatore un'offerta in stato **Richiesta** e avvisa l'ufficio in un canale x-bees.
Il bot **non mostra mai prezzi, costi o margini**: l'ufficio controlla e prezza l'offerta.

Indirizzo degli strumenti: `https://unytdhjxgbspchydgure.supabase.co/functions/v1/wx-bot`

## 0. Chiave del bot (una volta)

1. Inventa una password lunga (es. 30+ caratteri casuali).
2. Supabase → Edge Functions → Secrets → aggiungi `WX_BOT_KEY` = quella password.
3. La stessa password va in ognuno dei 3 Webhook tool qui sotto, in *Authorization → Bearer token*.

## 1. Wilma Tools (WMS → PBX → Integrations → Cloud integrations → AI → Capabilities → Wilma Tools)

Per tutti e tre: Method **POST**, URL quello sopra, Authorization **Bearer token** = `WX_BOT_KEY`, Body **JSON**.

### cerca_cliente
- Descrizione: *Cerca un cliente nell'anagrafica di TC Sistem per nome o partita IVA. Restituisce cliente_id, nome, città e P.IVA. Usalo sempre prima di creare la richiesta.*
- Variabili: `testo` (String) — parte del nome o della P.IVA del cliente
- Body: `{"azione":"cerca_cliente","testo":"{{testo}}"}`

### cerca_articolo
- Descrizione: *Cerca articoli nel listino Wildix e nei materiali di TC Sistem. Restituisce codice, descrizione e modalità (acquisto o canone). Non restituisce prezzi.*
- Variabili: `testo` (String) — parole da cercare (es. "telefono start", "licenza essential", "numero DID"); `tipo` (String) — "noleggio", "acquisto" o vuoto
- Body: `{"azione":"cerca_articolo","testo":"{{testo}}","tipo":"{{tipo}}"}`

### crea_richiesta
- Descrizione: *Crea nel preventivatore la richiesta d'offerta. Da usare solo dopo che il venditore ha confermato il riepilogo. Restituisce il numero dell'offerta e il testo da mandare all'ufficio (messaggio_ufficio).*
- Variabili: `venditore` (String), `cliente_id` (String, vuoto se il cliente non è in anagrafica), `cliente` (String), `codici` (String Array), `quantita` (Number Array, stesso ordine dei codici), `oggetto` (String), `note` (String)
- Body:
  ```json
  {"azione":"crea_richiesta","venditore":"{{venditore}}","cliente_id":"{{cliente_id}}","cliente":"{{cliente}}","codici":{{codici}},"quantita":{{quantita}},"oggetto":"{{oggetto}}","note":"{{note}}"}
  ```

### avvisa_ufficio (Functions → Send Message)
- Recipient Type: **Channel**, Channel ID: il canale x-bees del gruppo ufficio
- Variabili: `testo` (String)
- Message: `{{testo}}`
- Agent Name: `Richieste offerte`

## 2. AI Chat Agent (Chat AI Agents → Add new agent → Generative AI)

Nome: **Richieste offerte TC Sistem**. Aggiungi le 4 capability qui sopra (Pipeline: *Blocking request*).
Visibility: *Allow users to find the bot using search*.

Istruzioni:

```
## Identità
Sei l'assistente interno di TC Sistem che raccoglie le richieste d'offerta dei venditori.
Parli solo con i venditori dell'azienda, in italiano, in modo breve e cordiale.

## Regole
- Non indicare MAI prezzi, costi, sconti o margini, anche se te li chiedono: rispondi che li prepara l'ufficio.
- Non inventare codici: usa solo quelli restituiti da cerca_articolo.
- Fai una domanda alla volta e solo se serve.

## Compito
1. Chiedi il nome del venditore se non lo conosci già dalla conversazione.
2. Chiedi il cliente e usa cerca_cliente. Se ci sono più risultati fai scegliere; se non c'è, usa il nome scritto dal venditore con cliente_id vuoto.
3. Per ogni prodotto richiesto usa cerca_articolo. Se non è chiaro chiedi se è a noleggio/canone o in acquisto
   e scegli l'articolo giusto. Chiedi le quantità mancanti.
4. Mostra un riepilogo (cliente, articoli con quantità, eventuali note) e chiedi conferma.
5. Dopo la conferma usa crea_richiesta con codici e quantità nello stesso ordine.
6. Poi usa avvisa_ufficio passando come testo il campo messaggio_ufficio ricevuto da crea_richiesta.
7. Rispondi al venditore con il numero della richiesta e che l'ufficio la sta preparando.
Se un prodotto non si trova nel listino, mettilo nelle note della richiesta.
```

## 3. Prova

Scrivi al bot in x-bees: *"offerta per Simoneschi, 10 licenze UC Essential e 10 telefoni Start5 a noleggio"*.
In Wilma Tools → View Traces vedi le chiamate. Nel preventivatore l'offerta compare in Archivio con stato **Richiesta**.
