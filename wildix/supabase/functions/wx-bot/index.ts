// Supabase Edge Function "wx-bot": strumenti (Wilma Tools > Webhook) per l'agente AI Wildix dei venditori.
// L'agente raccoglie la richiesta in chat e crea un'offerta in stato "Richiesta" che l'ufficio poi controlla e prezza.
// Ai venditori NON vengono mai restituiti prezzi, costi o margini.
//
// Impostazioni della funzione: "Verify JWT" DISATTIVATO (Wildix si autentica con la chiave qui sotto).
// Segreto richiesto (Supabase > Edge Functions > Secrets):
//   WX_BOT_KEY   una password lunga a scelta; la stessa va messa in WMS nei Webhook tool come "Bearer token"
// Azioni (body JSON):
//   {"azione":"cerca_cliente","testo":"rossi"}
//   {"azione":"cerca_articolo","testo":"telefono start","tipo":"noleggio|acquisto|"}
//   {"azione":"crea_richiesta","venditore":"Mario","cliente":"Rossi srl","cliente_id":"","codici":["UC-ESSENTIAL-1m"],"quantita":[10],"oggetto":"","note":""}
import { createClient } from "npm:@supabase/supabase-js@2";

const SITO = "https://tcsistem.github.io/preventivi/wildix/";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const MODALITA: Record<string, string> = { "": "acquisto / una tantum", "1m": "canone mensile", "1y": "canone annuale", "5y": "canone 5 anni" };
const uuid = () => crypto.randomUUID();

// Wildix può passare gli array come JSON, come testo "a, b" o come righe separate: li accetto tutti
function lista(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = String(v ?? "").trim(); if (!s) return [];
  if (s.startsWith("[")) { try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map((x) => String(x).trim()).filter(Boolean); } catch { /* testo */ } }
  return s.split(/[\n;,]+/).map((x) => x.trim()).filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    const key = Deno.env.get("WX_BOT_KEY");
    const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!key || auth !== key) return json({ errore: "Non autorizzato" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const azione = String(body.azione || "");

    const { data: imp } = await sb.from("wx_impostazioni").select("dati").eq("id", 1).maybeSingle();
    const set: any = imp?.dati || {};
    const versione = set.versione || "";

    // ------------------------------------------------------------------ clienti
    if (azione === "cerca_cliente") {
      const t = String(body.testo || "").trim(); if (t.length < 2) return json({ risultati: [], messaggio: "Scrivi almeno 2 lettere del nome." });
      const parole = t.toLowerCase().split(/\s+/).map((w) => w.replace(/[%,()*]/g, "")).filter((w) => w.length > 1).slice(0, 4);
      if (!parole.length) return json({ risultati: [] });
      const lunga = [...parole].sort((a, b) => b.length - a.length)[0];
      const { data: tutti } = await sb.from("wx_clienti").select("id, rs, citta, prov, piva").or(`rs.ilike.%${lunga}%,piva.ilike.%${lunga}%`).limit(300);
      const data = (tutti || []).filter((c: any) => parole.every((w) => (c.rs + " " + c.piva).toLowerCase().includes(w))).slice(0, 8);
      return json({ risultati: (data || []).map((c: any) => ({ cliente_id: c.id, nome: c.rs, citta: [c.citta, c.prov].filter(Boolean).join(" "), piva: c.piva })),
        messaggio: data?.length ? "" : "Nessun cliente trovato in anagrafica: puoi creare la richiesta con il nome scritto dal venditore." });
    }

    // ------------------------------------------------------------------ articoli (senza prezzi)
    if (azione === "cerca_articolo") {
      const parole = String(body.testo || "").toLowerCase().split(/\s+/).map((w) => w.replace(/[%,()*]/g, "")).filter((w) => w.length > 1).slice(0, 5);
      if (!parole.length) return json({ risultati: [] });
      const tipo = String(body.tipo || "").toLowerCase();
      const lunga = [...parole].sort((a, b) => b.length - a.length)[0];
      const { data: grezzi } = await sb.from("wx_listino").select("versione, listino, categoria, codice, descrizione, periodo, marca")
        .or(`codice.ilike.%${lunga}%,descrizione.ilike.%${lunga}%,categoria.ilike.%${lunga}%,marca.ilike.%${lunga}%`).limit(1000);
      const data = (grezzi || []).filter((a: any) => (a.listino === "PERSONALE" || a.versione === versione) &&
        parole.every((w) => [a.codice, a.descrizione, a.categoria, a.marca].join(" ").toLowerCase().includes(w)));
      const visti = new Set<string>(); const out: any[] = [];
      for (const a of data || []) {
        if (tipo.startsWith("nol") && !a.periodo) continue;
        if (tipo.startsWith("acq") && a.periodo) continue;
        const k = a.listino + "|" + a.codice; if (visti.has(k)) continue; visti.add(k);
        out.push({ codice: a.codice, descrizione: a.descrizione, categoria: a.categoria, modalita: MODALITA[a.periodo || ""], fonte: a.listino === "PERSONALE" ? "materiali" : "Wildix " + a.listino });
        if (out.length >= 12) break;
      }
      return json({ risultati: out, messaggio: out.length ? "" : "Nessun articolo trovato: prova con altre parole o inseriscilo come nota." });
    }

    // ------------------------------------------------------------------ crea la richiesta d'offerta
    if (azione === "crea_richiesta") {
      const venditore = String(body.venditore || "").trim();
      const codici = lista(body.codici), qta = lista(body.quantita).map(num);
      if (!venditore) return json({ errore: "Manca il nome del venditore." }, 400);
      if (!codici.length) return json({ errore: "Nessun articolo indicato." }, 400);

      let cli: any = null;
      if (body.cliente_id) cli = (await sb.from("wx_clienti").select("*").eq("id", String(body.cliente_id)).maybeSingle()).data;
      const nomeCliente = (cli?.rs || String(body.cliente || "")).trim();
      if (!nomeCliente) return json({ errore: "Manca il cliente." }, 400);

      const { data: grezzi } = await sb.from("wx_listino").select("*").or(codici.map((c) => `codice.ilike.${c.replace(/[%,()*]/g, "")}`).join(",")).limit(1000);
      const arts = (grezzi || []).filter((a: any) => a.listino === "PERSONALE" || a.versione === versione);
      const sconto = num(set.sconto), ricarico = set.ricarico === undefined ? 30 : num(set.ricarico);
      const righe: any[] = [], nonTrovati: string[] = [];
      codici.forEach((cod, i) => {
        const q = qta[i] > 0 ? qta[i] : 1;
        const tutte = (arts || []).filter((a: any) => a.codice.toLowerCase() === cod.toLowerCase());
        if (!tutte.length) { nonTrovati.push(cod); righe.push({ id: uuid(), tipo: "libera", fonte: "", codice: "", descr: cod + " (da verificare)", periodo: "", qta: q, costo: "", listino: "", perc: ricarico, prezzo: "", modo: "ric" }); return; }
        const fonte = tutte.find((a: any) => a.listino !== "PERSONALE")?.listino || "PERSONALE";
        const delListino = tutte.filter((a: any) => a.listino === fonte).sort((a: any, b: any) => (a.q_min ?? 0) - (b.q_min ?? 0));
        const conFasce = delListino.filter((a: any) => a.q_min !== null);
        const a = !conFasce.length ? delListino[0]
          : conFasce.find((x: any) => q >= x.q_min && (x.q_max === null || q <= x.q_max)) || (q < conFasce[0].q_min ? conFasce[0] : conFasce[conFasce.length - 1]);
        const eu = num(a.prezzo_eu), gold = num(a.prezzo_gold);
        const r: any = { id: uuid(), tipo: "art", fonte, codice: a.codice, descr: a.descrizione, descrEn: a.descrizione, categoria: a.categoria, periodo: a.periodo || "",
          qta: q, costo: gold, listino: eu, fascia: a.fascia || "", auto: true, um: a.um || "" };
        if (eu > 0) { r.modo = "sc"; r.perc = fonte === "PERSONALE" ? 0 : sconto; r.prezzo = r2(eu * (1 - r.perc / 100)); }
        else { r.modo = "ric"; r.perc = ricarico; r.prezzo = r2(gold * (1 + ricarico / 100)); }
        righe.push(r);
      });

      // totali come nell'app
      const per: Record<string, { ric: number; cos: number }> = { "": { ric: 0, cos: 0 }, "1m": { ric: 0, cos: 0 }, "1y": { ric: 0, cos: 0 }, "5y": { ric: 0, cos: 0 } };
      righe.forEach((r) => { per[r.periodo || ""].ric += num(r.prezzo) * num(r.qta); per[r.periodo || ""].cos += num(r.costo) * num(r.qta); });
      const f1: Record<string, number> = { "": 1, "1m": 12, "1y": 1, "5y": 1 };
      let v1 = 0, c1 = 0; for (const p in per) { v1 += per[p].ric * f1[p]; c1 += per[p].cos * f1[p]; }

      const blocco = cli ? [cli.rs, cli.ind, [cli.cap, cli.citta, cli.prov ? "(" + cli.prov + ")" : ""].filter(Boolean).join(" "), cli.piva ? "P.IVA " + cli.piva : ""].filter(Boolean).join("\n") : nomeCliente;
      const note = String(body.note || "").trim();
      const oggetto = String(body.oggetto || "").trim() || `Richiesta di ${venditore}`;
      const cond = Object.assign({ validita: 30, pagamento: "", consegna: "", durata: "", iva: "", garanzia: "", note: "" }, set.cond || {});

      let numero = "", res: any = null;
      for (let tent = 0; tent < 3; tent++) {
        numero = (await sb.rpc("wx_prossimo_numero")).data || ("P" + Date.now() + "-" + String(new Date().getFullYear()).slice(2));
        res = await sb.from("wx_offerte").insert({
          numero, data: new Date().toISOString().slice(0, 10), stato: "Richiesta", cliente_id: cli?.id || null, cliente: nomeCliente, cliente_blocco: blocco,
          attenzione: cli?.ref || "", redatto: venditore, oggetto, versione_listino: versione,
          parametri: { sconto, ricarico, codici: true, unit: true, en: false, vista: "m", richiesta: { venditore, note, non_trovati: nonTrovati, quando: new Date().toISOString(), canale: "bot Wildix" } },
          righe, costi: [], condizioni: cond,
          tot_una_tantum: r2(per[""].ric), tot_mensile: r2(per["1m"].ric), tot_annuale: r2(per["1y"].ric), valore_anno1: r2(v1), costo_anno1: r2(c1), margine_anno1: r2(v1 - c1),
          created_by: null, updated_by: null,
        }).select("id").single();
        if (!res.error || res.error.code !== "23505") break;
      }
      if (res.error) throw new Error(res.error.message);
      const riepilogo = righe.map((r) => `${r.qta} × ${r.codice || r.descr}`).join(", ");
      return json({ ok: true, numero, cliente: nomeCliente, venditore, righe: righe.length, riepilogo, articoli_non_trovati: nonTrovati, note,
        link: SITO + "#offerta=" + res.data.id,
        messaggio_ufficio: `Nuova richiesta d'offerta ${numero} da ${venditore} per ${nomeCliente}: ${riepilogo}.${note ? " Note: " + note : ""}${nonTrovati.length ? " Da verificare: " + nonTrovati.join(", ") + "." : ""} ${SITO}#offerta=${res.data.id}` });
    }

    return json({ errore: "Azione sconosciuta: usa cerca_cliente, cerca_articolo o crea_richiesta." }, 400);
  } catch (e) {
    return json({ errore: (e as Error).message }, 500);
  }
});
