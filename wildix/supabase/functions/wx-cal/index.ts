// Supabase Edge Function "wx-cal": ticket pianificati -> calendario Microsoft 365 (Microsoft Graph, app registrata in Entra).
// "Verify JWT" DISATTIVATO. Chiamate accettate:
//   - dal trigger del database (header x-segreto = wx_segreti.cal_hook): {azione:"sincronizza", ticket} | {azione:"cancella", evento_id}
//   - dal gestionale con l'utente collegato (wx_is_utente): {azione:"test"} | {azione:"sincronizza", ticket}
// Segreti (Supabase > Edge Functions > Secrets):
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   app registrata con permesso applicazione "Calendars.ReadWrite" (consenso amministratore)
//   MS_CAL_USER   facoltativo, la casella del calendario (default c.tecnico@tcsimpiantisrl.onmicrosoft.com)
import { createClient } from "npm:@supabase/supabase-js@2";

const SITO = "https://tcsistem.github.io/preventivi/wildix/";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const casella = () => Deno.env.get("MS_CAL_USER") || "c.tecnico@tcsimpiantisrl.onmicrosoft.com";

let tok: { v: string; exp: number } | null = null;
async function token() {
  if (tok && tok.exp > Date.now() + 60000) return tok.v;
  const t = Deno.env.get("MS_TENANT_ID"), id = Deno.env.get("MS_CLIENT_ID"), sec = Deno.env.get("MS_CLIENT_SECRET");
  if (!t || !id || !sec) throw new Error("Mancano i segreti MS_TENANT_ID, MS_CLIENT_ID e MS_CLIENT_SECRET nelle Edge Functions di Supabase.");
  const r = await fetch(`https://login.microsoftonline.com/${t}/oauth2/v2.0/token`, { method: "POST",
    body: new URLSearchParams({ client_id: id, client_secret: sec, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }) });
  const d = await r.json();
  if (!r.ok) throw new Error("Accesso a Microsoft non riuscito: " + (d.error_description || d.error || r.status));
  tok = { v: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return tok.v;
}
async function graph(path: string, init: RequestInit = {}) {
  const r = await fetch("https://graph.microsoft.com/v1.0" + path, { ...init, headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/json", Prefer: 'outlook.timezone="Europe/Rome"', ...(init.headers || {}) } });
  if (r.status === 204) return null;
  const txt = await r.text(); let d: any = null; try { d = txt ? JSON.parse(txt) : null; } catch { d = txt; }
  if (!r.ok) { const e: any = new Error(`Microsoft Graph (${r.status}): ${d?.error?.message || txt}`); e.status = r.status; throw e; }
  return d;
}
const pad = (n: number) => String(n).padStart(2, "0");
function intervallo(data: string, ora: string | null, durata: number) {
  if (!ora) {                       // solo il giorno: appuntamento di tutta la giornata
    const d = new Date(data + "T00:00:00Z"); const f = new Date(d.getTime() + 864e5);
    return { isAllDay: true, start: { dateTime: data + "T00:00:00", timeZone: "Europe/Rome" }, end: { dateTime: f.toISOString().slice(0, 10) + "T00:00:00", timeZone: "Europe/Rome" } };
  }
  const [h, m] = ora.split(":").map(Number); const ini = h * 60 + m, fin = ini + Math.max(15, durata || 60);
  const giorno = new Date(data + "T00:00:00Z"); const fg = new Date(giorno.getTime() + Math.floor(fin / 1440) * 864e5).toISOString().slice(0, 10);
  return { isAllDay: false, start: { dateTime: `${data}T${pad(h)}:${pad(m)}:00`, timeZone: "Europe/Rome" },
    end: { dateTime: `${fg}T${pad(Math.floor((fin % 1440) / 60))}:${pad(fin % 60)}:00`, timeZone: "Europe/Rome" } };
}
function evento(t: any) {
  const pre = t.stato === "Chiuso" ? "✔ " : t.priorita === "Urgente" ? "🔴 " : "";
  const righe = [
    ["Ticket", t.numero], ["Cliente", t.cliente], ["Referente", [t.richiedente, t.telefono].filter(Boolean).join(" – ")], ["Email", t.email],
    ["Tecnico", t.tecnico], ["Priorità", t.priorita], ["Stato", t.stato],
  ].filter((r) => r[1]).map((r) => `<b>${esc(r[0])}:</b> ${esc(r[1])}`).join("<br>");
  return {
    subject: `${pre}${t.numero} · ${t.cliente || "Cliente"}${t.oggetto ? " – " + t.oggetto : ""}${t.tecnico ? " (" + t.tecnico + ")" : ""}`.slice(0, 250),
    body: { contentType: "HTML", content: `${righe}<br><br>${esc(t.descrizione).replace(/\n/g, "<br>")}<br><br><a href="${SITO}#ticket=${t.id}">Apri il ticket nel gestionale</a>` },
    location: { displayName: t.indirizzo || "" }, categories: ["Assistenza TC Sistem"], showAs: "busy",
    ...intervallo(String(t.data_intervento), t.ora_intervento ? String(t.ora_intervento).slice(0, 5) : null, t.durata_min),
  };
}
async function sincronizza(id: string) {
  const { data: t } = await admin.from("wx_ticket").select("*").eq("id", id).maybeSingle();
  if (!t) return { ok: true, nulla: true };
  const u = encodeURIComponent(casella());
  try {
    if (!t.data_intervento) {          // data tolta: tolgo l'appuntamento
      if (t.evento_id) { try { await graph(`/users/${u}/events/${t.evento_id}`, { method: "DELETE" }); } catch (e: any) { if (e.status !== 404) throw e; } }
      await admin.from("wx_ticket").update({ evento_id: null, evento_stato: "" }).eq("id", id);
      return { ok: true, cancellato: true };
    }
    let ev: any = null;
    if (t.evento_id) { try { ev = await graph(`/users/${u}/events/${t.evento_id}`, { method: "PATCH", body: JSON.stringify(evento(t)) }); } catch (e: any) { if (e.status !== 404) throw e; } }
    if (!ev) ev = await graph(`/users/${u}/events`, { method: "POST", body: JSON.stringify(evento(t)) });
    await admin.from("wx_ticket").update({ evento_id: ev.id, evento_stato: "ok " + new Date().toISOString() }).eq("id", id);
    return { ok: true, evento_id: ev.id, link: ev.webLink || "" };
  } catch (e) {
    await admin.from("wx_ticket").update({ evento_stato: "errore: " + (e as Error).message.slice(0, 300) }).eq("id", id);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const hook = (await admin.from("wx_segreti").select("valore").eq("chiave", "cal_hook").maybeSingle()).data?.valore;
    let ammesso = !!hook && req.headers.get("x-segreto") === hook;
    if (!ammesso) {                    // chiamata dal gestionale: utente collegato e abilitato
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const ok = await sb.rpc("wx_is_utente"); ammesso = !ok.error && !!ok.data;
      if (!ammesso) return json({ errore: "Non autorizzato" }, 401);
      if (b.azione === "cancella") return json({ errore: "Non consentito" }, 403);
    }
    if (b.azione === "test") {
      const u = encodeURIComponent(casella());
      const cal = await graph(`/users/${u}/calendar?$select=name,owner`);
      return json({ ok: true, calendario: cal?.name || "", casella: casella() });
    }
    if (b.azione === "sincronizza") return json(await sincronizza(String(b.ticket)));
    if (b.azione === "cancella" && b.evento_id) {
      try { await graph(`/users/${encodeURIComponent(casella())}/events/${b.evento_id}`, { method: "DELETE" }); } catch (e: any) { if (e.status !== 404) throw e; }
      return json({ ok: true });
    }
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    return json({ errore: (e as Error).message }, 500);
  }
});
