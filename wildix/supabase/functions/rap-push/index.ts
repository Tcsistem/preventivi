// Supabase Edge Function "rap-push": notifiche push ai telefoni dei tecnici (app rapportini) per i nuovi ticket.
// "Verify JWT" DISATTIVATO.
//   {"azione":"chiave"}                  -> chiave pubblica VAPID (pubblica, serve al telefono per iscriversi)
//   {"azione":"invia","ticket":"<uuid>"} -> solo dal trigger del database (header x-segreto = wx_segreti.push_hook)
// Le chiavi VAPID vengono generate al primo uso e salvate in wx_segreti: nessuno deve copiarle a mano.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function segreto(k: string) { return (await sb.from("wx_segreti").select("valore").eq("chiave", k).maybeSingle()).data?.valore || ""; }
async function chiavi() {
  let pub = await segreto("vapid_public"), priv = await segreto("vapid_private");
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey;
    await sb.from("wx_segreti").upsert([{ chiave: "vapid_public", valore: pub }, { chiave: "vapid_private", valore: priv }]);
    // se due chiamate partono insieme vince la prima: rileggo
    pub = await segreto("vapid_public"); priv = await segreto("vapid_private");
  }
  return { pub, priv };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    if (b.azione === "chiave") return json({ ok: true, chiave: (await chiavi()).pub });

    if (b.azione === "invia") {
      const atteso = await segreto("push_hook");
      if (!atteso || req.headers.get("x-segreto") !== atteso) return json({ errore: "Non autorizzato" }, 401);
      const { data: t } = await sb.from("wx_ticket").select("id, numero, priorita, cliente, oggetto").eq("id", String(b.ticket)).maybeSingle();
      if (!t) return json({ errore: "Ticket non trovato" }, 404);
      const { pub, priv } = await chiavi();
      webpush.setVapidDetails("mailto:amministrazione@tcsistem.it", pub, priv);
      const payload = JSON.stringify({
        title: `${t.priorita === "Urgente" ? "🔴 URGENTE · " : t.priorita === "Alta" ? "🟠 " : ""}Nuovo ticket ${t.numero}`,
        body: [t.cliente, t.oggetto].filter(Boolean).join(" – ").slice(0, 180),
        tag: "ticket-" + t.id, url: "./?tab=ticket",
      });
      const { data: subs } = await sb.from("rap_push").select("endpoint, sub");
      let inviate = 0;
      for (const s of subs || []) {
        try { await webpush.sendNotification(s.sub, payload, { TTL: 86400, urgency: t.priorita === "Urgente" ? "high" : "normal" }); inviate++; }
        catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("rap_push").delete().eq("endpoint", s.endpoint); }
      }
      return json({ ok: true, inviate });
    }
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    return json({ errore: String((e as Error).message || e) }, 500);
  }
});
