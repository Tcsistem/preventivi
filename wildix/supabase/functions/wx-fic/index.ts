// Supabase Edge Function "wx-fic": crea in Fatture in Cloud una fattura PROFORMA da un'offerta del preventivatore.
// Segreti richiesti (Supabase > Edge Functions > Secrets):
//   FIC_TOKEN       token di accesso di Fatture in Cloud (permessi: proforma in scrittura, clienti in lettura/scrittura, impostazioni in lettura)
//   FIC_COMPANY_ID  facoltativo: se manca si usa la prima azienda collegata al token
// Azioni (body JSON): {azione:"test"}  oppure  {azione:"proforma", offerta_id:"uuid"}
//   oppure {azione:"proforma_rapportino", rapportino_id:123, cliente_id:"uuid"|null, righe:[{descr,qta,prezzo,um}]}
//   ("verifica" / "verifica_rapportino" preparano tutto senza creare nulla)
import { createClient } from "npm:@supabase/supabase-js@2";

const FIC = "https://api-v2.fattureincloud.it";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const PERIODO: Record<string, string> = { "1m": "canone mensile – 1° mese", "1y": "canone annuale – 1° anno", "5y": "canone 5 anni anticipato" };

async function fic(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("FIC_TOKEN");
  if (!token) throw new Error("Manca il segreto FIC_TOKEN nelle Edge Functions di Supabase.");
  const res = await fetch(FIC + path, { ...init, headers: { "Authorization": "Bearer " + token, "Accept": "application/json", "Content-Type": "application/json", ...(init.headers || {}) } });
  const txt = await res.text(); let body: any = null; try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
  if (!res.ok) {
    const det = body?.error?.validation_result ? " " + JSON.stringify(body.error.validation_result) : "";
    throw new Error(`Fatture in Cloud (${res.status}): ${body?.error?.message || txt || res.statusText}${det}`);
  }
  return body;
}

async function companyId(): Promise<{ id: number; name: string }> {
  const fromEnv = Deno.env.get("FIC_COMPANY_ID");
  const r = await fic("/user/companies");
  const list = r?.data?.companies || [];
  if (fromEnv) { const c = list.find((x: any) => String(x.id) === String(fromEnv)); return { id: +fromEnv, name: c?.name || "" }; }
  if (!list.length) throw new Error("Il token non è collegato a nessuna azienda di Fatture in Cloud.");
  return { id: list[0].id, name: list[0].name };
}

// cliente in Fatture in Cloud: cerco per P.IVA (o codice fiscale), poi per nome; se manca lo creo in anagrafica
async function entita(comp: { id: number }, cli: any, nomeLibero: string, prova: boolean) {
  const nome = (cli?.rs || nomeLibero || "").trim();
  if (!nome) throw new Error("Manca il cliente.");
  const idf = String(cli?.piva || "").replace(/\s/g, "").replace(/^IT/i, "");
  const piva = /^\d{11}$/.test(idf) ? idf : "";
  const cf = !piva && /^[A-Z0-9]{16}$/i.test(idf) ? idf.toUpperCase() : (/^\d{11}$/.test(idf) ? idf : "");
  const anag: Record<string, unknown> = {
    name: nome, vat_number: piva, tax_code: cf || piva,
    address_street: cli?.ind || "", address_postal_code: cli?.cap || "", address_city: cli?.citta || "", address_province: cli?.prov || "",
    country: "Italia", email: cli?.email || "", certified_email: cli?.pec || "", ei_code: cli?.sdi || "", phone: cli?.tel || "",
  };
  let entityId: number | null = null, clienteCreato = false;
  const cerca = async (q: string) => (await fic(`/c/${comp.id}/entities/clients?fieldset=basic&per_page=5&q=${encodeURIComponent(q)}`))?.data?.[0]?.id ?? null;
  const prove: string[] = [];
  if (piva) prove.push(`vat_number = '${piva}'`, `tax_code = '${piva}'`);
  if (cf && cf !== piva) prove.push(`tax_code = '${cf}'`);
  prove.push(`name = '${nome.replace(/'/g, "''")}'`);
  for (const q of prove) { entityId = await cerca(q); if (entityId) break; }
  if (!entityId && !prova && (piva || cf || cli)) {
    try {
      const created = await fic(`/c/${comp.id}/entities/clients`, { method: "POST", body: JSON.stringify({ data: { ...anag, type: piva ? "company" : "person" } }) });
      entityId = created?.data?.id ?? null; clienteCreato = true;
    } catch (e) { if (!/\(409\)/.test((e as Error).message)) throw e; }
  }
  return { anag, entityId, clienteCreato };
}
async function iva22(comp: { id: number }) {
  const vt = await fic(`/c/${comp.id}/info/vat_types`);
  const iva = (vt?.data || []).find((v: any) => +v.value === 22 && !v.is_disabled) || (vt?.data || []).find((v: any) => +v.value === 22);
  if (!iva) throw new Error("In Fatture in Cloud non trovo l'aliquota IVA 22%.");
  return iva;
}
async function creaProforma(comp: { id: number; name: string }, ent: any, items: any[], testi: { visible_subject: string; subject: string; notes: string }, prova: boolean) {
  const oggi = new Date().toISOString().slice(0, 10);
  const doc: Record<string, unknown> = {
    type: "proforma", entity: { ...ent.anag, ...(ent.entityId ? { id: ent.entityId } : {}) }, date: oggi, ...testi,
    currency: { id: "EUR" }, language: { code: "it", name: "Italiano" }, items_list: items, use_gross_prices: false,
  };
  const tot = await fic(`/c/${comp.id}/issued_documents/totals`, { method: "POST", body: JSON.stringify({ data: doc }) });
  const dovuto = tot?.data?.amount_due ?? tot?.data?.amount_gross;
  doc.payments_list = [{ amount: dovuto, due_date: oggi, status: "not_paid" }];
  if (prova) return { ok: true, prova: true, cliente_trovato: !!ent.entityId, totale: dovuto, righe: items.length, documento: doc };
  const res = await fic(`/c/${comp.id}/issued_documents`, { method: "POST", body: JSON.stringify({ data: doc }) });
  const d = res?.data || {};
  return { ok: true, id: d.id, numero: d.number != null ? `${d.number}${d.numeration || ""}` : "", data: d.date, url: d.url || "",
    totale: dovuto, cliente_creato: ent.clienteCreato, azienda: comp.name, righe: items.length };
}
const dataIt = (d: string) => String(d || "").slice(0, 10).split("-").reverse().join("/");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const ok = await sb.rpc("wx_is_utente");
    if (ok.error || !ok.data) return json({ errore: "Utente non abilitato al preventivatore." }, 403);

    const body = await req.json();
    const { azione, offerta_id } = body;
    const comp = await companyId();
    if (azione === "test") return json({ ok: true, azienda: comp.name, company_id: comp.id });

    // ---- proforma da un rapportino dei tecnici: righe preparate nel gestionale
    if (azione === "proforma_rapportino" || azione === "verifica_rapportino") {
      const provaR = azione === "verifica_rapportino";
      const { data: rap, error: er } = await sb.from("rapportini").select("id, numero, data, cliente, descrizione, proforma").eq("id", body.rapportino_id).maybeSingle();
      if (er || !rap) return json({ errore: "Rapportino non trovato." }, 404);
      if (rap.proforma?.id && !provaR && !body.di_nuovo) return json({ errore: `Per questo rapportino c'è già la proforma n. ${rap.proforma.numero}.`, gia: rap.proforma }, 409);
      let cliR: any = null;
      if (body.cliente_id) cliR = (await sb.from("wx_clienti").select("*").eq("id", body.cliente_id).maybeSingle()).data;
      const ivaR = await iva22(comp);
      const itemsR = (Array.isArray(body.righe) ? body.righe : []).filter((r: any) => String(r.descr || "").trim() && num(r.qta))
        .slice(0, 100).map((r: any) => ({ name: String(r.descr).trim().slice(0, 2000), qty: num(r.qta), net_price: r2(num(r.prezzo)),
          discount: 0, vat: { id: ivaR.id }, measure: String(r.um || "").slice(0, 10) }));
      if (!itemsR.length) return json({ errore: "Nessuna riga da mettere nella proforma." }, 400);
      const entR = await entita(comp, cliR, String(body.cliente || rap.cliente || ""), provaR);
      const rif = `Rapportino n. ${rap.numero} del ${dataIt(rap.data)}`;
      const out: any = await creaProforma(comp, entR, itemsR, { visible_subject: `Intervento tecnico – ${rif}`, subject: `Da rapportino ${rap.numero}`, notes: `Rif. ${rif}` }, provaR);
      if (!provaR && out.id) await sb.from("rapportini").update({ proforma: { id: out.id, numero: out.numero, data: out.data, url: out.url, totale: out.totale } }).eq("id", rap.id);
      return json(out);
    }
    // "verifica": prepara tutto (cliente, IVA, righe, totali) senza creare nulla in Fatture in Cloud
    const prova = azione === "verifica";
    if ((azione !== "proforma" && !prova) || !offerta_id) return json({ errore: "Richiesta non valida." }, 400);

    const { data: o, error } = await sb.from("wx_offerte").select("*").eq("id", offerta_id).maybeSingle();
    if (error || !o) return json({ errore: "Offerta non trovata: salvala prima di creare la proforma." }, 404);
    let cli: any = null;
    if (o.cliente_id) cli = (await sb.from("wx_clienti").select("*").eq("id", o.cliente_id).maybeSingle()).data;

    // ---- cliente in Fatture in Cloud: cerco per P.IVA (o codice fiscale), altrimenti lo creo in anagrafica
    const nome = (cli?.rs || o.cliente || "").trim();
    if (!nome) return json({ errore: "Nell'offerta manca il cliente." }, 400);
    const idf = String(cli?.piva || "").replace(/\s/g, "").replace(/^IT/i, "");
    const piva = /^\d{11}$/.test(idf) ? idf : "";
    const cf = !piva && /^[A-Z0-9]{16}$/i.test(idf) ? idf.toUpperCase() : (/^\d{11}$/.test(idf) ? idf : "");
    const anag: Record<string, unknown> = {
      name: nome, vat_number: piva, tax_code: cf || piva,
      address_street: cli?.ind || "", address_postal_code: cli?.cap || "", address_city: cli?.citta || "", address_province: cli?.prov || "",
      country: "Italia", email: cli?.email || "", certified_email: cli?.pec || "", ei_code: cli?.sdi || "", phone: cli?.tel || "",
    };
    let entityId: number | null = null, clienteCreato = false;
    // ricerca nella rubrica: prima per P.IVA, poi per codice fiscale (enti, scuole, privati), infine per nome esatto
    const cerca = async (q: string) => (await fic(`/c/${comp.id}/entities/clients?fieldset=basic&per_page=5&q=${encodeURIComponent(q)}`))?.data?.[0]?.id ?? null;
    const prove: string[] = [];
    if (piva) prove.push(`vat_number = '${piva}'`, `tax_code = '${piva}'`);
    if (cf && cf !== piva) prove.push(`tax_code = '${cf}'`);
    prove.push(`name = '${nome.replace(/'/g, "''")}'`);
    for (const q of prove) { entityId = await cerca(q); if (entityId) break; }
    if (entityId) { /* trovato */ }
    else if (!prova) {
      try {
        const created = await fic(`/c/${comp.id}/entities/clients`, { method: "POST", body: JSON.stringify({ data: { ...anag, type: piva ? "company" : "person" } }) });
        entityId = created?.data?.id ?? null; clienteCreato = true;
      } catch (e) {
        // già presente in rubrica ma non trovato dalla ricerca (es. dati scritti in modo diverso): la proforma riporta comunque i dati del cliente
        if (!/\(409\)/.test((e as Error).message)) throw e;
      }
    }

    // ---- IVA 22%
    const vt = await fic(`/c/${comp.id}/info/vat_types`);
    const iva = (vt?.data || []).find((v: any) => +v.value === 22 && !v.is_disabled) || (vt?.data || []).find((v: any) => +v.value === 22);
    if (!iva) throw new Error("In Fatture in Cloud non trovo l'aliquota IVA 22%.");

    // ---- righe: tutte le una tantum + il primo periodo dei canoni
    const items = (o.righe || []).filter((r: any) => r.tipo !== "sez" && num(r.qta) && String(r.descr || "").trim())
      .map((r: any) => {
        const per = r.periodo || "";
        const descr = String(r.descr).trim();
        return { code: String(r.codice || "").slice(0, 50), name: (per ? `${descr} (${PERIODO[per]})` : descr).slice(0, 2000),
          qty: num(r.qta), net_price: r2(num(r.prezzo)), discount: 0, vat: { id: iva.id }, measure: String(r.um || "").slice(0, 10) };
      });
    if (!items.length) return json({ errore: "L'offerta non ha righe da mettere nella proforma." }, 400);

    const oggi = new Date().toISOString().slice(0, 10);
    const doc: Record<string, unknown> = {
      type: "proforma", entity: { ...anag, ...(entityId ? { id: entityId } : {}) }, date: oggi,
      visible_subject: o.oggetto || `Offerta ${o.numero}`, subject: `Da offerta ${o.numero}`,
      notes: `Rif. nostra offerta n. ${o.numero} del ${String(o.data).split("-").reverse().join("/")}`,
      currency: { id: "EUR" }, language: { code: "it", name: "Italiano" }, items_list: items, use_gross_prices: false,
    };
    const tot = await fic(`/c/${comp.id}/issued_documents/totals`, { method: "POST", body: JSON.stringify({ data: doc }) });
    const dovuto = tot?.data?.amount_due ?? tot?.data?.amount_gross;
    doc.payments_list = [{ amount: dovuto, due_date: oggi, status: "not_paid" }];
    if (prova) return json({ ok: true, prova: true, cliente_trovato: !!entityId, totale: dovuto, righe: items.length, documento: doc });
    const res = await fic(`/c/${comp.id}/issued_documents`, { method: "POST", body: JSON.stringify({ data: doc }) });
    const d = res?.data || {};
    return json({ ok: true, id: d.id, numero: d.number != null ? `${d.number}${d.numeration || ""}` : "", data: d.date, url: d.url || "",
      totale: dovuto, cliente_creato: clienteCreato, azienda: comp.name, righe: items.length });
  } catch (e) {
    return json({ errore: (e as Error).message }, 500);
  }
});
