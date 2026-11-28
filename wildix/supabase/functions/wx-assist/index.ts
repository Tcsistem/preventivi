// Supabase Edge Function "wx-assist": strumenti per l'assistenza (ticket / richieste di intervento).
// Usata dagli agenti AI Wildix (chat clienti, WhatsApp, chat interna) e dalla lettura delle email.
// "Verify JWT" DISATTIVATO: ci si autentica con la stessa chiave del bot offerte (segreto WX_BOT_KEY, Bearer).
// Ai clienti non vengono mai restituiti dati di altri clienti: il cliente viene riconosciuto solo lato server.
//
// Azioni (body JSON):
//   {"azione":"apri_ticket","canale":"chat cliente|whatsapp|chat interna|email","azienda":"","richiedente":"","telefono":"","email":"",
//    "indirizzo":"","oggetto":"","descrizione":"","urgenza":"bassa|normale|alta|urgente","cliente_id":"","email_message_id":""}
//   {"azione":"stato_ticket","numero":"T001-26"}
//   {"azione":"aggiungi_nota","numero":"T001-26","testo":"...","chi":"..."}
import { createClient } from "npm:@supabase/supabase-js@2";

const SITO = "https://tcsistem.github.io/preventivi/wildix/";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const PRIO: Record<string, string> = { bassa: "Bassa", normale: "Normale", alta: "Alta", urgente: "Urgente" };
const pulisci = (v: unknown, max = 4000) => String(v ?? "").replace(/\{\{[^}]*\}\}/g, "").trim().slice(0, max);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|spa|srl|snc|sas)\b/g, "").replace(/[^a-z0-9]/g, "");

Deno.serve(async (req) => {
  try {
    const key = Deno.env.get("WX_BOT_KEY");
    const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!key || auth !== key) return json({ errore: "Non autorizzato" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const b = await req.json().catch(() => ({}));
    const azione = String(b.azione || "");

    // ------------------------------------------------------------------ apri ticket
    if (azione === "apri_ticket") {
      const descrizione = pulisci(b.descrizione);
      if (!descrizione) return json({ errore: "Manca la descrizione del problema." }, 400);
      const msgId = pulisci(b.email_message_id, 500);
      if (msgId) {
        const { data: gia } = await sb.from("wx_ticket").select("id, numero").eq("email_message_id", msgId).maybeSingle();
        if (gia) return json({ ok: true, gia_presente: true, numero: gia.numero, messaggio_ufficio: "", link: SITO + "#ticket=" + gia.id });
      }
      const azienda = pulisci(b.azienda, 300), email = pulisci(b.email, 300).toLowerCase(), telefono = pulisci(b.telefono, 60);

      // riconoscimento del cliente in anagrafica (solo lato server): id, P.IVA nel testo, email, nome azienda
      let cli: any = null;
      if (b.cliente_id) cli = (await sb.from("wx_clienti").select("*").eq("id", String(b.cliente_id)).maybeSingle()).data;
      if (!cli) {
        const piva = (azienda + " " + descrizione).match(/\b\d{11}\b/)?.[0];
        if (piva) cli = (await sb.from("wx_clienti").select("*").eq("piva", piva).limit(1)).data?.[0] || null;
      }
      if (!cli && email) cli = (await sb.from("wx_clienti").select("*").ilike("email", email).limit(1)).data?.[0] || null;
      if (!cli && azienda.length > 2) {
        const parola = azienda.split(/\s+/).sort((x, y) => y.length - x.length)[0].replace(/[%,()*]/g, "");
        const { data } = await sb.from("wx_clienti").select("*").ilike("rs", `%${parola}%`).limit(50);
        const n = norm(azienda); const esatti = (data || []).filter((c: any) => norm(c.rs) === n);
        if (esatti.length === 1) cli = esatti[0];
      }

      const canale = pulisci(b.canale, 40) || "chat";
      const urg = PRIO[pulisci(b.urgenza, 20).toLowerCase()] || "Normale";
      const oggetto = pulisci(b.oggetto, 200) || descrizione.split(/[.\n]/)[0].slice(0, 120);
      const quando = new Date().toISOString();
      let numero = "", res: any = null;
      for (let t = 0; t < 3; t++) {
        numero = (await sb.rpc("wx_prossimo_ticket")).data || ("T" + Date.now());
        res = await sb.from("wx_ticket").insert({
          numero, stato: "Nuovo", priorita: urg, canale, cliente_id: cli?.id || null, cliente: cli?.rs || azienda,
          richiedente: pulisci(b.richiedente, 200), telefono, email, indirizzo: pulisci(b.indirizzo, 300) || (cli ? [cli.ind, cli.cap, cli.citta, cli.prov].filter(Boolean).join(" ") : ""),
          oggetto, descrizione, email_message_id: msgId || null,
          storico: [{ quando, chi: canale, testo: "Ticket aperto da " + canale }], created_by: null, updated_by: null,
        }).select("id").single();
        if (!res.error || res.error.code !== "23505") break;
      }
      if (res.error) throw new Error(res.error.message);
      const chi = [pulisci(b.richiedente, 200), cli?.rs || azienda].filter(Boolean).join(" – ");
      return json({ ok: true, numero, cliente_riconosciuto: !!cli, priorita: urg,
        link: SITO + "#ticket=" + res.data.id,
        messaggio_ufficio: `🛠 Nuova richiesta di assistenza ${numero} (${urg}, da ${canale})${chi ? " – " + chi : ""}${telefono ? " – tel. " + telefono : ""}: ${oggetto}. ${SITO}#ticket=${res.data.id}` });
    }

    // ------------------------------------------------------------------ stato ticket (solo informazioni non interne)
    if (azione === "stato_ticket") {
      const numero = pulisci(b.numero, 20).toUpperCase();
      const { data: t } = await sb.from("wx_ticket").select("numero, stato, data_intervento, oggetto, created_at").eq("numero", numero).maybeSingle();
      if (!t) return json({ trovato: false, messaggio: "Nessuna richiesta con questo numero." });
      return json({ trovato: true, numero: t.numero, stato: t.stato, oggetto: t.oggetto, aperto_il: String(t.created_at).slice(0, 10), intervento_previsto: t.data_intervento || "" });
    }

    // ------------------------------------------------------------------ nota aggiuntiva dal cliente / dal bot
    if (azione === "aggiungi_nota") {
      const numero = pulisci(b.numero, 20).toUpperCase(), testo = pulisci(b.testo);
      if (!testo) return json({ errore: "Testo vuoto." }, 400);
      const { data: t } = await sb.from("wx_ticket").select("id, storico").eq("numero", numero).maybeSingle();
      if (!t) return json({ errore: "Nessuna richiesta con questo numero." }, 404);
      const storico = [...(t.storico || []), { quando: new Date().toISOString(), chi: pulisci(b.chi, 100) || "cliente", testo }];
      const { error } = await sb.from("wx_ticket").update({ storico }).eq("id", t.id);
      if (error) throw new Error(error.message);
      return json({ ok: true, numero });
    }

    return json({ errore: "Azione sconosciuta: usa apri_ticket, stato_ticket o aggiungi_nota." }, 400);
  } catch (e) {
    return json({ errore: (e as Error).message }, 500);
  }
});
