(function(){
"use strict";
const CFG = window.WX_CONFIG || {};
const LISTINI_INCLUSI = [{versione:"Novembre 2026", file:"data/listino-2026-11.json"}];
const PERIODI = [["","Una tantum"],["1m","Mensile"],["1y","Annuale"],["5y","5 anni"]];
const PER_LAB = Object.fromEntries(PERIODI);
const PER_ANNO1 = {"":1,"1m":12,"1y":1,"5y":1};
const PER_STAMPA = {"":"Totale una tantum","1m":"Canone mensile","1y":"Canone annuale","5y":"Canone 5 anni (anticipato)"};
const DEFAULT_SET = {
  azienda:{nome:"TC Sistem", tel:"", logo:"img/logo-tcsistem.png", dettagli:"Indirizzo – CAP Città (LT)\nP.IVA 00000000000\namministrazione@tcsistem.it"},
  sconto:0, ricarico:30, versione:"",
  cond:{validita:30, pagamento:"Bonifico bancario 30 gg d.f.", consegna:"Da concordare", durata:"36 mesi per i servizi a canone",
        iva:"Esclusa (aliquota di legge)", garanzia:"Secondo le condizioni del produttore", note:""},
  preset:[{descr:"Ore tecnico installazione e configurazione", costo:30, periodo:""},{descr:"Trasferta", costo:50, periodo:""},{descr:"Connettività fornitore", costo:25, periodo:"1m"}]
};

/* ---------------------------------------------------------------- utilità */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { if (v === null || v === undefined || v === "") return 0; if (typeof v === "number") return isFinite(v)?v:0;
  const s = String(v).trim().replace(/\s|€/g,""); const n = parseFloat(s.includes(",") ? s.replace(/\./g,"").replace(",",".") : s); return isFinite(n) ? n : 0; };
const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const fmtE = new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",useGrouping:"always"});
const fmtN = new Intl.NumberFormat("it-IT",{maximumFractionDigits:2,useGrouping:"always"});
const fmtI = new Intl.NumberFormat("it-IT",{minimumFractionDigits:2, maximumFractionDigits:4,useGrouping:"always"});
const eur = v => fmtE.format(v||0);
const n2 = v => fmtN.format(v||0);
const inN = v => (v === "" || v === null || v === undefined) ? "" : String(v).replace(".", ",");
const today = () => new Date().toISOString().slice(0,10);
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==="x"?r:(r&3|8)).toString(16); });
const clone = o => JSON.parse(JSON.stringify(o));
const fmtDate = iso => { if(!iso) return ""; const [y,m,d]=String(iso).slice(0,10).split("-"); return `${d}/${m}/${y}`; };
const addDays = (iso,n) => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+(+n||0)); return d.toISOString().slice(0,10); };
function lsGet(k,def){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; } }
function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2800); }
function errMsg(e){
  if (!e) return "Errore sconosciuto";
  if (e.code === "42501" || /permission|row-level/i.test(e.message||"")) return "Permesso negato: il tuo utente non è abilitato (tabella wx_utenti).";
  if (e.code === "42P01" || /does not exist|schema cache/i.test(e.message||"")) return "Tabelle mancanti: esegui wildix/supabase/schema.sql nel progetto Supabase.";
  if (/fetch|network/i.test(e.message||"")) return "Connessione assente: riprova.";
  return e.message || String(e);
}
function deepMerge(base, over){ const o = clone(base); for (const k in (over||{})){ if (over[k] && typeof over[k]==="object" && !Array.isArray(over[k]) && o[k] && typeof o[k]==="object" && !Array.isArray(o[k])) o[k] = deepMerge(o[k], over[k]); else if (over[k] !== undefined && over[k] !== null) o[k] = over[k]; } return o; }

/* ---------------------------------------------------------------- stato */
const S = {
  sb:null, user:null, profilo:null, prova:false,
  settings: clone(DEFAULT_SET),
  clienti:[], offerte:[], utenti:{},
  listino:[], byCode:new Map(), versioni:[],
  offer:null, dirty:false, saving:false,
  filtro:{l:"", per:"*", cat:"", q:""}
};
const draftKey = () => "wx-prev-bozza-" + (S.user ? S.user.id : "");

/* ---------------------------------------------------------------- listino in memoria */
function indicizza(){
  S.byCode = new Map();
  S.listino.forEach(a => { const k = a.listino+"|"+a.codice; if (!S.byCode.has(k)) S.byCode.set(k, []); S.byCode.get(k).push(a); });
  S.byCode.forEach(arr => arr.sort((a,b)=>(a.q_min??0)-(b.q_min??0)));
  const cats = [...new Set(S.listino.map(a=>a.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  $("#qCat").innerHTML = `<option value="">Ogni categoria</option>` + cats.map(c=>`<option>${esc(c)}</option>`).join("");
  const n = S.listino.filter(a=>a.listino!=="PERSONALE").length;
  $("#lstInfo").textContent = n ? `Listino in uso: ${S.settings.versione || "—"} (${n} righe)` : "Nessun listino nel database: aprilo dalla scheda Listini.";
}
function fasciaPer(fonte, codice, qta){
  const arr = S.byCode.get(fonte+"|"+codice); if (!arr || !arr.length) return null;
  const q = Math.max(1, qta||1);
  const conFasce = arr.filter(a => a.q_min !== null && a.q_min !== undefined);
  if (!conFasce.length) return arr[0];
  return conFasce.find(a => q >= a.q_min && (a.q_max === null || a.q_max === undefined || q <= a.q_max))
      || (q < conFasce[0].q_min ? conFasce[0] : conFasce[conFasce.length-1]);
}
async function loadListino(){
  const ver = S.settings.versione;
  const all = [];
  for (const [col,val] of [["versione", ver], ["listino","PERSONALE"]]){
    if (!val) continue;
    for (let from=0; ; from+=1000){
      const {data, error} = await S.sb.from("wx_listino").select("*").eq(col, val).order("id").range(from, from+999);
      if (error){ toast(errMsg(error)); break; }
      all.push(...data.filter(a => col==="listino" || a.listino!=="PERSONALE"));
      if (data.length < 1000) break;
    }
  }
  all.forEach(a => { ["prezzo_gold","prezzo_eu","ppm_gold","ppm_eu"].forEach(k => a[k] = a[k]===null||a[k]===undefined ? null : +a[k]); });
  S.listino = all; indicizza(); cerca();
  const avviso = $("#avvisoListino"); if (avviso && all.some(a => a.listino !== "PERSONALE")) avviso.remove();
}
async function loadVersioni(){
  const {data, error} = await S.sb.rpc("wx_versioni_listino");
  S.versioni = error ? [] : (data||[]);
  const vers = [...new Set(S.versioni.filter(v=>v.listino!=="PERSONALE").map(v=>v.versione))];
  if (!S.settings.versione || !vers.includes(S.settings.versione)) S.settings.versione = vers[0] || "";
  return vers;
}

/* ---------------------------------------------------------------- ricerca articoli */
function cerca(){
  const F = S.filtro, box = $("#artRes");
  const words = F.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length && !F.l && !F.cat && F.per==="*"){ box.innerHTML = ""; return; }
  const seen = new Set(), out = [];
  for (const a of S.listino){
    if (F.l && a.listino !== F.l) continue;
    if (F.per !== "*" && (a.periodo||"") !== F.per) continue;
    if (F.cat && a.categoria !== F.cat) continue;
    const k = a.listino+"|"+a.codice; if (seen.has(k)) continue;
    const hay = (a.codice+" "+a.descrizione+" "+a.categoria+" "+(a.listino==="CLASSOUND"?a.fascia:"")).toLowerCase();
    if (!words.every(w => hay.includes(w))) continue;
    seen.add(k); out.push(a); if (out.length > 80) break;
  }
  if (!out.length){ box.innerHTML = `<div class="empty"><b>Nessun articolo</b>${S.listino.length ? "Prova con un'altra parola o togli i filtri." : "Carica un listino dalla scheda Listini."}</div>`; return; }
  box.innerHTML = out.slice(0,80).map(a => {
    const arr = S.byCode.get(a.listino+"|"+a.codice) || [a]; const first = arr[0];
    const fasce = arr.length > 1 ? `${arr.length} fasce di quantità · ` : "";
    const per = PER_LAB[a.periodo||""];
    return `<div class="art"><div class="cod"><span class="tag ${a.listino}">${a.listino==="PERSONALE"?"MAT":esc(a.listino)}</span>${esc(a.codice)}</div>
      <div class="des">${esc(a.descrizione)}<small>${esc([a.marca, a.categoria].filter(Boolean).join(" · "))}${a.um?" · "+esc(a.um):""} · ${per}${a.listino==="CLASSOUND"&&a.fascia?" · "+esc(a.fascia):""} · ${fasce}${arr.length>1?"prezzi della prima fascia ("+esc(first.fascia)+")":""}</small></div>
      <div class="pz g">Costo<b>${eur(first.prezzo_gold)}</b></div><div class="pz">Listino<b>${eur(first.prezzo_eu)}</b></div>
      <button class="btn sm" type="button" data-add="${esc(k_(a))}">+ Aggiungi</button></div>`;
  }).join("") + (out.length > 80 ? `<div class="more">Altri risultati: scrivi qualche parola in più.</div>` : "");
}
const k_ = a => a.listino+"|"+a.codice;
$("#qArt").addEventListener("input", e => { S.filtro.q = e.target.value; cerca(); });
$("#qPer").addEventListener("change", e => { S.filtro.per = e.target.value; cerca(); });
$("#qCat").addEventListener("change", e => { S.filtro.cat = e.target.value; cerca(); });
$("#segLst").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.filtro.l = b.dataset.l;
  $$("#segLst button").forEach(x => x.setAttribute("aria-pressed", String(x===b))); cerca(); });
$("#artRes").addEventListener("click", e => {
  const b = e.target.closest("[data-add]"); if (!b) return;
  const [fonte, ...rest] = b.dataset.add.split("|"); const codice = rest.join("|");
  const a = fasciaPer(fonte, codice, 1); if (!a) return;
  const sc = num(S.offer.parametri.sconto);
  const r = {id:uid(), tipo:"art", fonte, codice, descr:a.descrizione, descrEn:a.descrizione, categoria:a.categoria,
    periodo:a.periodo||"", qta:1, costo:a.prezzo_gold, listino:a.prezzo_eu, perc: fonte==="PERSONALE" ? 0 : sc, prezzo:0, fascia:a.fascia||"", auto:true, um:a.um||""};
  if (fonte === "PERSONALE" && !(num(a.prezzo_eu) > 0)){ r.modo = "ric"; r.perc = num(S.offer.parametri.ricarico); }
  ricalcolaPrezzo(r);
  if (fonte !== "PERSONALE") S.offer.versione = S.settings.versione;
  S.offer.righe.push(r); renderRighe(); update(); markDirty();
  toast("Aggiunto: " + codice);
});

/* ---------------------------------------------------------------- offerta: modello e calcoli */
// numerazione: P001-26, P002-26, … (ricomincia da P001 ogni anno)
function nextNumero(){
  const yy = String(new Date().getFullYear()).slice(2); let max = 0;
  S.offerte.forEach(o => { const m = String(o.numero||"").match(/^P(\d+)-(\d{2})$/); if (m && m[2]===yy) max = Math.max(max, +m[1]); });
  return `P${String(max+1).padStart(3,"0")}-${yy}`;
}
function newOffer(){
  const s = S.settings;
  return { id:uid(), numero:nextNumero(), data:today(), stato:"Bozza", clienteId:"", cliente:"", clienteBlocco:"", attenzione:"",
    redatto:(S.profilo && S.profilo.nome) || "", oggetto:"", versione:s.versione,
    parametri:{sconto:s.sconto, ricarico:s.ricarico, codici:true, unit:true, listino:false, en:false},
    righe:[], costi:[], condizioni:clone(s.cond), isNew:true, updatedAt:null };
}
const haListino = r => num(r.listino) > 0;
// modo della %: "sc" = sconto sul listino End User, "ric" = ricarico sul mio costo (Gold)
const modoDi = r => (r.modo === "ric" || !haListino(r)) ? "ric" : (r.modo === "sc" ? "sc" : "sc");
function ricalcolaPrezzo(r){
  if (r.tipo === "sez") return;
  const p = num(r.perc);
  r.prezzo = modoDi(r) === "sc" ? r2(num(r.listino) * (1 - p/100)) : r2(num(r.costo) * (1 + p/100));
}
function ricalcolaPerc(r){
  const pz = num(r.prezzo);
  if (modoDi(r) === "sc") r.perc = r2((1 - pz/num(r.listino)) * 100);
  else if (num(r.costo) > 0) r.perc = r2((pz/num(r.costo) - 1) * 100);
  else r.perc = "";
}
function modoSel(r){
  const m = modoDi(r);
  return `<select data-k="modo" class="modo" title="Come si calcola il prezzo">
    <option value="sc"${m==="sc"?" selected":""}${haListino(r)?"":" disabled"}>sconto</option>
    <option value="ric"${m==="ric"?" selected":""}>ricarico</option></select>`;
}
function calc(o){
  const per = {}; PERIODI.forEach(([p]) => per[p] = {ricavo:0, costo:0, interni:0});
  const rows = o.righe.map(r => {
    if (r.tipo === "sez") return {sez:true};
    const qta = num(r.qta), costo = num(r.costo), prezzo = num(r.prezzo), p = r.periodo||"";
    const tot = prezzo*qta, cTot = costo*qta;
    per[p].ricavo += tot; per[p].costo += cTot;
    return {qta, costo, prezzo, tot, cTot, marg: tot-cTot, p, filled: !!(String(r.descr||"").trim() || qta || tot)};
  });
  const costi = o.costi.map(c => { const t = num(c.qta) * num(c.costo); per[c.periodo||""].interni += t; return t; });
  let ricavo1 = 0, costo1 = 0;
  PERIODI.forEach(([p]) => { const g = per[p]; g.costoTot = g.costo + g.interni; g.marg = g.ricavo - g.costoTot;
    ricavo1 += g.ricavo * PER_ANNO1[p]; costo1 += g.costoTot * PER_ANNO1[p]; });
  return {rows, costi, per, ricavo1, costo1, marg1: ricavo1-costo1, perc1: ricavo1 ? (ricavo1-costo1)/ricavo1*100 : 0};
}

/* ---------------------------------------------------------------- viste */
function show(view){
  $$(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.view===view)));
  $$(".view").forEach(v => v.hidden = v.id !== "v-"+view);
  if (view==="archivio") renderArchivio();
  if (view==="clienti") renderClienti();
  if (view==="listini") renderListini();
  if (view==="materiali") renderMiei();
  if (view==="assistenza"){ renderTicket(); loadTicket(); }
  if (view==="impostazioni") renderSettings();
  window.scrollTo(0,0);
}
$$(".tab").forEach(t => t.addEventListener("click", () => show(t.dataset.view)));
function setStatus(){
  $("#dot").className = "dot " + (S.dirty ? "dirty" : "ok");
  $("#statusText").textContent = S.saving ? "Salvataggio…" : S.dirty ? "Modifiche non salvate" : (S.offer && S.offer.isNew ? "Offerta nuova, non ancora salvata" : "Tutto salvato");
}
function markDirty(){ S.dirty = true; lsSet(draftKey(), S.offer); setStatus(); $("#saveHint").textContent = ""; }

/* ---------------------------------------------------------------- editor: testata e condizioni */
function bloccoCliente(c){
  return [c.rs, c.ind, [c.cap, c.citta, c.prov ? "("+c.prov+")" : ""].filter(Boolean).join(" "), c.piva ? "P.IVA " + c.piva : ""].filter(Boolean).join("\n");
}
const HDR = {oNumero:"numero", oData:"data", oAttenzione:"attenzione", oStato:"stato", oRedatto:"redatto", oOggetto:"oggetto", oBlocco:"clienteBlocco"};
const COND = {cValidita:"validita", cPagamento:"pagamento", cConsegna:"consegna", cDurata:"durata", cIva:"iva", cGaranzia:"garanzia", cNote:"note"};
const PSTAMPA = {pCodici:"codici", pUnit:"unit", pEn:"en"};
function loadOfferIntoForm(){
  const o = S.offer;
  $("#hNum").textContent = o.numero; chipStato();
  $("#oCliente").value = o.cliente;
  for (const id in HDR) $("#"+id).value = o[HDR[id]] ?? "";
  for (const id in COND) $("#"+id).value = o.condizioni[COND[id]] ?? "";
  for (const id in PSTAMPA) $("#"+id).checked = !!o.parametri[PSTAMPA[id]];
  $("#gSconto").value = inN(o.parametri.sconto); $("#gRicarico").value = inN(o.parametri.ricarico);
  renderRighe(); renderCosti(); update(); ficInfo(); richInfo();
}
function richInfo(){
  const R = S.offer.parametri && S.offer.parametri.richiesta, el = $("#richInfo");
  if (!R){ el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<b>Richiesta dal ${esc(R.canale||"bot")}</b> · venditore <b>${esc(R.venditore||"")}</b>${R.quando?" · "+new Date(R.quando).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"}):""}
    ${R.note?`<div>Note: ${esc(R.note)}</div>`:""}${R.non_trovati&&R.non_trovati.length?`<div class="neg">Nuovi materiali da prezzare (aggiunti in Materiali senza prezzo): ${esc(R.non_trovati.join(", "))}</div>`:""}
    <div class="hint">Controlla righe, sconti e costi interni, poi cambia lo stato in Bozza o Inviata.</div>`;
}
function chipStato(){ const s=S.offer.stato, c=$("#hStato"); c.textContent=s; c.className="chip "+(s==="Accettata"?"good":s==="Inviata"?"navy":s==="Persa"?"red":s==="Richiesta"?"warn":""); }
for (const id in HDR) $("#"+id).addEventListener("input", e => { S.offer[HDR[id]] = e.target.value; if (id==="oNumero") $("#hNum").textContent = e.target.value; if (id==="oStato") chipStato(); markDirty(); });
for (const id in COND) $("#"+id).addEventListener("input", e => { S.offer.condizioni[COND[id]] = e.target.value; markDirty(); });
for (const id in PSTAMPA) $("#"+id).addEventListener("change", e => { S.offer.parametri[PSTAMPA[id]] = e.target.checked; markDirty(); });
$("#oCliente").addEventListener("input", e => {
  const v = e.target.value; S.offer.cliente = v;
  const c = S.clienti.find(x => x.rs.toLowerCase() === v.trim().toLowerCase());
  if (c){ S.offer.clienteId = c.id; S.offer.clienteBlocco = bloccoCliente(c); if (c.ref && !S.offer.attenzione){ S.offer.attenzione = c.ref; $("#oAttenzione").value = c.ref; } $("#oBlocco").value = S.offer.clienteBlocco; }
  else { S.offer.clienteId = ""; if (!S.offer.clienteBlocco || S.offer.clienteBlocco.split("\n").length===1){ S.offer.clienteBlocco = v; $("#oBlocco").value = v; } }
  markDirty();
});
function fillDatalists(){
  $("#dlClienti").innerHTML = S.clienti.slice(0,3000).map(c=>`<option value="${esc(c.rs)}">${esc([c.citta,c.piva].filter(Boolean).join(" · "))}</option>`).join("");
  $("#selPreset").innerHTML = `<option value="">+ Voce rapida…</option>` + (S.settings.preset||[]).map((p,i)=>`<option value="${i}">${esc(p.descr)} (${eur(p.costo)}${p.periodo?" "+PER_LAB[p.periodo].toLowerCase():""})</option>`).join("");
  }

/* ---------------------------------------------------------------- editor: righe */
const perSel = (v, k="periodo") => `<select data-k="${k}">${PERIODI.map(([p,l])=>`<option value="${p}"${(v||"")===p?" selected":""}>${l}</option>`).join("")}</select>`;
function rigaHtml(r, i){
  const act = `<div class="acts"><button class="btn sm ghost" data-a="su" title="Sposta su" type="button">↑</button><button class="btn sm ghost" data-a="giu" title="Sposta giù" type="button">↓</button><button class="btn sm ghost danger" data-a="via" title="Elimina riga" type="button">✕</button>${r.tipo==="libera"?`<button class="btn sm ghost" data-a="salva" title="Salva nei Materiali" type="button">💾</button>`:""}</div>`;
  if (r.tipo === "sez") return `<tr class="sez" data-i="${i}"><td class="idx">§${act}</td><td class="in" colspan="10"><input data-k="descr" value="${esc(r.descr)}" placeholder="Titolo di sezione (es. Telefoni e accessori)"></td></tr>`;
  const tiers = r.tipo==="art" ? (S.byCode.get(r.fonte+"|"+r.codice)||[]).length : 0;
  const cod = r.tipo === "art"
    ? `<td class="cod"><span class="tag ${esc(r.fonte)}">${r.fonte==="PERSONALE"?"MAT":esc(r.fonte)}</span>${esc(r.codice)}${r.fascia ? `<br><span class="fascia" title="${tiers>1?"Fascia scelta in automatico dalla quantità":""}">${r.fonte==="CLASSOUND"?"":"fascia "}${esc(r.fascia)}</span>` : ""}</td>`
    : `<td class="in"><input data-k="codice" value="${esc(r.codice)}" placeholder="Codice" style="min-width:90px"><span class="tag LIBERA">LIBERA</span></td>`;
  return `<tr data-i="${i}"><td class="idx">${i+1}${act}</td>${cod}
    <td class="in"><textarea data-k="descr" rows="2">${esc(r.descr)}</textarea></td>
    <td class="in">${perSel(r.periodo)}</td>
    <td class="in"><input class="n w60" data-k="qta" inputmode="decimal" value="${esc(inN(r.qta))}"></td>
    <td class="in int"><input class="n w80" data-k="costo" inputmode="decimal" value="${esc(inN(r.costo))}"></td>
    <td class="in"><input class="n w80" data-k="listino" inputmode="decimal" value="${esc(inN(r.listino))}" placeholder="—"></td>
    <td class="in"><input class="n w60" data-k="perc" inputmode="decimal" value="${esc(inN(r.perc))}" title="${modoDi(r)==="sc"?"Sconto % sul listino":"Ricarico % sul costo"}">${modoSel(r)}</td>
    <td class="in"><input class="n w80" data-k="prezzo" inputmode="decimal" value="${esc(inN(r.prezzo))}"></td>
    <td class="c tot" data-o="tot"></td><td class="c int" data-o="marg"></td></tr>`;
}
function renderRighe(){
  const tb = $("#tbRighe");
  tb.innerHTML = S.offer.righe.length ? S.offer.righe.map(rigaHtml).join("") : `<tr><td colspan="11"><div class="empty"><b>Nessuna riga</b>Cerca un articolo qui sopra e premi “+ Aggiungi”, oppure aggiungi una riga libera.</div></td></tr>`;
}
function aggiornaCelle(){
  const k = calc(S.offer);
  $$("#tbRighe tr[data-i]").forEach(tr => {
    const i = +tr.dataset.i, c = k.rows[i]; if (!c || c.sez) return;
    const t = $('[data-o="tot"]', tr), m = $('[data-o="marg"]', tr);
    t.textContent = eur(c.tot); m.textContent = eur(c.marg); m.classList.toggle("neg", c.marg < 0);
  });
  $$("#tbCosti tr[data-i]").forEach(tr => { const i = +tr.dataset.i; $('[data-o="tot"]', tr).textContent = eur(k.costi[i]); });
  return k;
}
function setInput(tr, key, val){ const el = $(`[data-k="${key}"]`, tr); if (el && el !== document.activeElement) el.value = inN(val); }
$("#tbRighe").addEventListener("input", e => {
  const tr = e.target.closest("tr[data-i]"); if (!tr) return;
  const r = S.offer.righe[+tr.dataset.i], key = e.target.dataset.k; if (!key) return;
  r[key] = e.target.value;
  if (key === "qta" && r.tipo === "art" && r.auto){
    const a = fasciaPer(r.fonte, r.codice, num(r.qta));
    if (a && (a.fascia||"") !== (r.fascia||"")){
      r.fascia = a.fascia||""; r.costo = a.prezzo_gold; r.listino = a.prezzo_eu; ricalcolaPrezzo(r);
      setInput(tr,"costo",r.costo); setInput(tr,"listino",r.listino); setInput(tr,"prezzo",r.prezzo);
      const f = $(".fascia", tr); if (f) f.textContent = "fascia " + r.fascia;
    }
  }
  if (key === "costo" || key === "listino") r.auto = false;           // prezzi toccati a mano: niente più cambio fascia automatico
  if (key === "perc" || (key === "listino" && modoDi(r) === "sc") || (key === "costo" && modoDi(r) === "ric")){ ricalcolaPrezzo(r); setInput(tr,"prezzo",r.prezzo); }
  if (key === "prezzo"){ ricalcolaPerc(r); setInput(tr,"perc",r.perc); }
  if (key === "listino"){ const sel = $('[data-k="modo"]', tr); if (sel && sel !== document.activeElement) sel.outerHTML = modoSel(r); }
  update(); markDirty();
});
$("#tbRighe").addEventListener("change", e => {
  if (e.target.tagName !== "SELECT") return;
  const tr = e.target.closest("tr[data-i]"), r = S.offer.righe[+tr.dataset.i];
  if (e.target.dataset.k === "modo"){
    // cambio sconto <-> ricarico: la % che hai scritto resta e si ricalcola il prezzo con il nuovo modo
    r.modo = e.target.value; ricalcolaPrezzo(r); setInput(tr,"prezzo",r.prezzo);
    const pc = $('[data-k="perc"]', tr); if (pc) pc.title = r.modo==="sc" ? "Sconto % sul listino" : "Ricarico % sul costo";
  } else r.periodo = e.target.value;
  update(); markDirty();
});
$("#tbRighe").addEventListener("click", e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const i = +b.closest("tr").dataset.i, R = S.offer.righe;
  if (b.dataset.a === "salva"){ const r = R[i];
    return editArticolo(null, {codice:r.codice||"", descrizione:r.descr||"", categoria:"", marca:"", um:r.um||"", periodo:r.periodo||"", prezzo_gold:r.costo, prezzo_eu:r.prezzo}); }
  if (b.dataset.a === "via") R.splice(i,1);
  if (b.dataset.a === "su" && i > 0) [R[i-1], R[i]] = [R[i], R[i-1]];
  if (b.dataset.a === "giu" && i < R.length-1) [R[i+1], R[i]] = [R[i], R[i+1]];
  renderRighe(); update(); markDirty();
});
$("#bRigaLibera").addEventListener("click", () => {
  const r = {id:uid(), tipo:"libera", fonte:"", codice:"", descr:"", periodo:"", qta:1, costo:"", listino:"", perc:num(S.offer.parametri.ricarico), prezzo:""};
  S.offer.righe.push(r); renderRighe(); update(); markDirty();
  const tr = $(`#tbRighe tr[data-i="${S.offer.righe.length-1}"]`); tr && $('[data-k="descr"]', tr).focus();
});
$("#bSezione").addEventListener("click", () => { S.offer.righe.push({id:uid(), tipo:"sez", descr:""}); renderRighe(); markDirty();
  const tr = $(`#tbRighe tr[data-i="${S.offer.righe.length-1}"]`); tr && $("input", tr).focus(); });
$("#gSconto").addEventListener("input", e => { S.offer.parametri.sconto = num(e.target.value); markDirty(); });
$("#gRicarico").addEventListener("input", e => { S.offer.parametri.ricarico = num(e.target.value); markDirty(); });
$("#bApplSconto").addEventListener("click", () => {
  const sc = num($("#gSconto").value); let n = 0;
  S.offer.righe.forEach(r => { if (r.tipo !== "sez" && haListino(r) && r.fonte !== "PERSONALE"){ r.modo = "sc"; r.perc = sc; ricalcolaPrezzo(r); n++; } });
  renderRighe(); update(); markDirty(); toast(`Sconto ${n2(sc)}% applicato a ${n} righe`);
});
$("#bApplRic").addEventListener("click", () => {
  const ric = num($("#gRicarico").value); let n = 0;
  S.offer.righe.forEach(r => { if (r.tipo !== "sez" && num(r.costo) > 0){ r.modo = "ric"; r.perc = ric; ricalcolaPrezzo(r); n++; } });
  renderRighe(); update(); markDirty(); toast(`Prezzi = costo + ${n2(ric)}% su ${n} righe`);
});

/* ---------------------------------------------------------------- editor: costi a me */
function renderCosti(){
  const C = S.offer.costi;
  $("#tbCosti").innerHTML = C.length ? C.map((c,i)=>`<tr data-i="${i}"><td class="idx">${i+1}</td>
    <td class="in int"><input data-k="descr" value="${esc(c.descr)}" placeholder="Es. Ore tecnico installazione"></td>
    <td class="in">${perSel(c.periodo)}</td>
    <td class="in"><input class="n w60" data-k="qta" inputmode="decimal" value="${esc(inN(c.qta))}"></td>
    <td class="in int"><input class="n w80" data-k="costo" inputmode="decimal" value="${esc(inN(c.costo))}"></td>
    <td class="c tot" data-o="tot"></td>
    <td class="act"><button class="btn sm ghost danger" data-a="via" type="button" title="Elimina">✕</button></td></tr>`).join("")
    : `<tr><td colspan="7"><div class="empty" style="padding:14px">Nessun costo interno.</div></td></tr>`;
}
$("#tbCosti").addEventListener("input", e => { const tr=e.target.closest("tr[data-i]"); if(!tr||!e.target.dataset.k) return; S.offer.costi[+tr.dataset.i][e.target.dataset.k] = e.target.value; update(); markDirty(); });
$("#tbCosti").addEventListener("change", e => { if (e.target.tagName==="SELECT"){ const tr=e.target.closest("tr[data-i]"); S.offer.costi[+tr.dataset.i].periodo = e.target.value; update(); markDirty(); } });
$("#tbCosti").addEventListener("click", e => { const b=e.target.closest("[data-a]"); if(!b) return; S.offer.costi.splice(+b.closest("tr").dataset.i,1); renderCosti(); update(); markDirty(); });
$("#bAddCosto").addEventListener("click", () => { S.offer.costi.push({id:uid(), descr:"", periodo:"", qta:1, costo:""}); renderCosti(); update(); markDirty(); $(`#tbCosti tr[data-i="${S.offer.costi.length-1}"] input`).focus(); });
$("#selPreset").addEventListener("change", e => {
  const p = (S.settings.preset||[])[+e.target.value]; e.target.value = ""; if (!p) return;
  S.offer.costi.push({id:uid(), descr:p.descr, periodo:p.periodo||"", qta:1, costo:p.costo}); renderCosti(); update(); markDirty();
});

/* ---------------------------------------------------------------- quadro economico */
const FATT = {m:{"1m":1,"1y":1/12,"5y":1/60}, a:{"1m":12,"1y":1,"5y":1/5}};
function canone(k, vista){
  const f = FATT[vista], o = {ricavo:0, costo:0, interni:0};
  for (const p in f){ const g = k.per[p]; o.ricavo += g.ricavo*f[p]; o.costo += g.costo*f[p]; o.interni += g.interni*f[p]; }
  o.costoTot = o.costo + o.interni; o.marg = o.ricavo - o.costoTot; return o;
}
function update(){
  const k = aggiornaCelle();
  const vista = S.offer.parametri.vista === "a" ? "a" : "m";
  const U = k.per[""], C = canone(k, vista), lab = vista === "m" ? "Canone mensile" : "Canone annuale";
  const haCan = C.ricavo || C.costoTot, haUna = U.ricavo || U.costoTot;
  const misti = ["1m","1y","5y"].filter(p => k.per[p].ricavo || k.per[p].costoTot).length > 1 || (vista==="m" && (k.per["1y"].ricavo||k.per["5y"].ricavo)) || (vista==="a" && (k.per["1m"].ricavo||k.per["5y"].ricavo));
  const pc = (m, r) => r ? ` <small>(${n2(m/r*100)}%)</small>` : "";
  const riga = (l, v, cls="") => `<div class="qr ${cls}"><span>${l}</span><b>${eur(v)}</b></div>`;
  const box = (tit, cls, una, can, extra="") => `<div class="qbox ${cls}"><div class="lab">${tit}</div>${haUna?riga("Una tantum", una):""}${haCan?riga(lab, can):""}${extra}</div>`;
  $("#quadro").innerHTML = (haUna || haCan) ? `
    <div class="seg qseg" role="group" aria-label="Canoni"><button type="button" data-v="m" aria-pressed="${vista==="m"}">Mensile</button><button type="button" data-v="a" aria-pressed="${vista==="a"}">Annuale</button></div>
    ${box("Il cliente paga", "cli", U.ricavo, C.ricavo)}
    ${box("I miei costi", "costi", U.costoTot, C.costoTot,
      (U.interni || C.interni) ? `<div class="qdett">Articoli (Gold): ${haUna?eur(U.costo):""}${haUna&&haCan?" + ":""}${haCan?eur(C.costo)+(vista==="m"?"/mese":"/anno"):""}<br>Costi interni: ${haUna?eur(U.interni):""}${haUna&&haCan?" + ":""}${haCan?eur(C.interni)+(vista==="m"?"/mese":"/anno"):""}</div>` : "")}
    <div class="qbox marg${(U.marg<0||C.marg<0)?" neg":""}"><div class="lab">Il mio margine</div>
      ${haUna?`<div class="qr"><span>Una tantum</span><b>${eur(U.marg)}${pc(U.marg,U.ricavo)}</b></div>`:""}
      ${haCan?`<div class="qr"><span>${lab}</span><b>${eur(C.marg)}${pc(C.marg,C.ricavo)}</b></div>`:""}</div>
    ${misti?`<p class="hint" style="margin:6px 0 0">Canoni con periodi diversi riportati ${vista==="m"?"al mese (annuale ÷ 12, 5 anni ÷ 60)":"all'anno (mensile × 12, 5 anni ÷ 5)"}.</p>`:""}
    <div class="qbox anno"><div class="lab">Primo anno</div>${riga("Valore", k.ricavo1)}${riga("Costi", k.costo1)}<div class="qr"><span>Margine</span><b>${eur(k.marg1)}${pc(k.marg1,k.ricavo1)}</b></div></div>`
  : `<p class="hint">Aggiungi righe per vedere i conti.</p>`;
  return k;
}
$("#quadro").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (!b) return; S.offer.parametri.vista = b.dataset.v; update(); markDirty(); });

/* ---------------------------------------------------------------- salvataggio */
function toRow(o){
  const k = calc(o);
  return { numero:o.numero, data:o.data||today(), stato:o.stato, cliente_id:o.clienteId||null, cliente:o.cliente, cliente_blocco:o.clienteBlocco,
    attenzione:o.attenzione, redatto:o.redatto, oggetto:o.oggetto, versione_listino:o.versione||"", parametri:o.parametri, righe:o.righe, costi:o.costi,
    condizioni:o.condizioni, tot_una_tantum:r2(k.per[""].ricavo), tot_mensile:r2(k.per["1m"].ricavo), tot_annuale:r2(k.per["1y"].ricavo),
    valore_anno1:r2(k.ricavo1), costo_anno1:r2(k.costo1), margine_anno1:r2(k.marg1) };
}
function fromRow(r){
  return { id:r.id, numero:r.numero, data:r.data, stato:r.stato, clienteId:r.cliente_id||"", cliente:r.cliente||"", clienteBlocco:r.cliente_blocco||"",
    attenzione:r.attenzione||"", redatto:r.redatto||"", oggetto:r.oggetto||"", versione:r.versione_listino||"",
    parametri:Object.assign({sconto:0,ricarico:30,codici:true,unit:true,listino:false,en:false}, r.parametri||{}),
    righe:r.righe||[], costi:r.costi||[], condizioni:Object.assign(clone(S.settings.cond), r.condizioni||{}), isNew:false, updatedAt:r.updated_at };
}
async function saveOffer(){
  if (S.saving) return; const o = S.offer;
  if (!String(o.numero).trim()) return toast("Manca il numero dell'offerta");
  S.saving = true; setStatus();
  try{
    const row = toRow(o); let res;
    if (o.isNew){
      res = await S.sb.from("wx_offerte").insert(Object.assign({id:o.id}, row)).select("updated_at");
      if (res.error && res.error.code === "23505"){
        const {data} = await S.sb.rpc("wx_prossimo_numero"); if (data){ o.numero = row.numero = data; $("#oNumero").value = data; $("#hNum").textContent = data; }
        res = await S.sb.from("wx_offerte").insert(Object.assign({id:o.id}, row)).select("updated_at");
        if (!res.error) toast("Numero già usato: l'offerta è diventata " + o.numero);
      }
    } else {
      const {data:cur} = await S.sb.from("wx_offerte").select("updated_at").eq("id", o.id).maybeSingle();
      if (cur && o.updatedAt && cur.updated_at !== o.updatedAt && !saveOffer.forza){
        S.saving = false; setStatus();
        return confirmBox("Offerta modificata da un altro utente", "Qualcun altro ha salvato questa offerta dopo che l'hai aperta. Sovrascrivere con la tua versione?", "Sovrascrivi", async () => { saveOffer.forza = true; await saveOffer(); saveOffer.forza = false; }, true);
      }
      res = await S.sb.from("wx_offerte").update(row).eq("id", o.id).select("updated_at");
    }
    if (res.error) throw res.error;
    o.isNew = false; o.updatedAt = res.data && res.data[0] ? res.data[0].updated_at : o.updatedAt;
    S.dirty = false; lsSet(draftKey(), null);
    $("#saveHint").textContent = "Salvata alle " + new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
    loadArchivio();
  }catch(e){ toast(errMsg(e)); }
  S.saving = false; setStatus();
}
$("#bSalva").addEventListener("click", () => saveOffer());
document.addEventListener("keydown", e => { if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="s"){ e.preventDefault(); if (!$("#v-offerta").hidden) saveOffer(); } });
function guardDirty(go){ if (!S.dirty) return go(); confirmBox("Modifiche non salvate", "L'offerta aperta ha modifiche non salvate. Continuare e perderle?", "Continua", go, true); }
$("#bNuova").addEventListener("click", () => guardDirty(() => { S.offer = newOffer(); S.dirty = false; lsSet(draftKey(), null); loadOfferIntoForm(); setStatus(); }));
$("#bDuplica").addEventListener("click", () => guardDirty(() => duplica(S.offer)));
function duplica(src){
  const o = clone(src); o.id = uid(); o.numero = nextNumero(); o.data = today(); o.stato = "Bozza"; o.isNew = true; o.updatedAt = null;
  o.righe.forEach(r => r.id = uid()); S.offer = o; S.dirty = true; loadOfferIntoForm(); show("offerta"); setStatus(); toast("Copia creata: " + o.numero + " (da salvare)");
}
async function openOffer(id){
  const {data, error} = await S.sb.from("wx_offerte").select("*").eq("id", id).maybeSingle();
  if (error || !data) return toast(error ? errMsg(error) : "Offerta non trovata");
  S.offer = fromRow(data); S.dirty = false; lsSet(draftKey(), null); loadOfferIntoForm(); setStatus(); show("offerta");
}

/* ---------------------------------------------------------------- archivio */
async function loadArchivio(){
  const {data, error} = await S.sb.from("wx_offerte").select("id, numero, data, stato, cliente, oggetto, tot_una_tantum, tot_mensile, tot_annuale, valore_anno1, margine_anno1, updated_at, updated_by").order("updated_at", {ascending:false}).range(0, 999);
  if (error){ toast(errMsg(error)); return; }
  S.offerte = data || []; if (!$("#v-archivio").hidden) renderArchivio();
}
function renderArchivio(){
  const q = $("#qArch").value.trim().toLowerCase();
  const L = S.offerte.filter(o => !q || [o.numero,o.cliente,o.oggetto,o.stato].join(" ").toLowerCase().includes(q));
  $("#archList").innerHTML = L.length ? `<div class="tablewrap" style="border:0"><table class="list"><thead><tr><th>Nr.</th><th>Data</th><th>Cliente</th><th>Oggetto</th><th>Stato</th><th class="r">Una tantum</th><th class="r">Mensile</th><th class="r">Margine 1° anno</th><th>Ultima modifica</th><th></th></tr></thead><tbody>
    ${L.map(o => `<tr class="click" data-id="${esc(o.id)}"><td><b>${esc(o.numero)}</b></td><td>${fmtDate(o.data)}</td><td>${esc(o.cliente)}</td><td>${esc(o.oggetto)}</td>
      <td><span class="chip ${o.stato==="Accettata"?"good":o.stato==="Inviata"?"navy":o.stato==="Persa"?"red":o.stato==="Richiesta"?"warn":""}">${esc(o.stato)}</span></td>
      <td class="r">${eur(+o.tot_una_tantum)}</td><td class="r">${eur(+o.tot_mensile)}</td><td class="r">${eur(+o.margine_anno1)}</td>
      <td class="hint">${new Date(o.updated_at).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"})}${S.utenti[o.updated_by]?" · "+esc(S.utenti[o.updated_by]):""}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-a="dup" type="button">Duplica</button> <button class="btn sm ghost danger" data-a="del" type="button">Elimina</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty"><b>${q?"Nessuna offerta trovata":"Nessuna offerta salvata"}</b>${q?"":"Le offerte salvate compaiono qui."}</div>`;
}
$("#qArch").addEventListener("input", renderArchivio);
$("#archList").addEventListener("click", async e => {
  const tr = e.target.closest("tr[data-id]"); if (!tr) return; const id = tr.dataset.id, o = S.offerte.find(x=>x.id===id);
  const a = e.target.closest("[data-a]");
  if (a && a.dataset.a === "del") return confirmBox("Eliminare l'offerta " + o.numero + "?", "L'offerta viene cancellata per tutti e non si può recuperare.", "Elimina", async () => {
    const {error} = await S.sb.from("wx_offerte").delete().eq("id", id); if (error) return toast(errMsg(error));
    if (S.offer && S.offer.id === id){ S.offer = newOffer(); S.dirty = false; loadOfferIntoForm(); }
    await loadArchivio(); renderArchivio(); toast("Offerta eliminata"); }, true);
  if (a && a.dataset.a === "dup") return guardDirty(async () => { const {data} = await S.sb.from("wx_offerte").select("*").eq("id", id).maybeSingle(); if (data) duplica(fromRow(data)); });
  guardDirty(() => openOffer(id));
});

/* ---------------------------------------------------------------- clienti */
const CLI_KEYS = ["rs","ind","cap","citta","prov","piva","email","pec","sdi","ref","tel"];
const CLI_LAB = {rs:"Ragione sociale",ind:"Indirizzo",cap:"CAP",citta:"Città",prov:"Prov.",piva:"P.IVA / C.F.",email:"Email",pec:"PEC",sdi:"Codice SDI",ref:"Referente",tel:"Telefono"};
async function loadClienti(){
  const all = [];
  for (let from=0; ; from+=1000){
    const {data, error} = await S.sb.from("wx_clienti").select("*").order("rs").range(from, from+999);
    if (error){ toast(errMsg(error)); break; } all.push(...data); if (data.length < 1000) break;
  }
  S.clienti = all; fillDatalists(); if (!$("#v-clienti").hidden) renderClienti();
}
function renderClienti(){
  const q = $("#qCli").value.trim().toLowerCase();
  const L = S.clienti.filter(c => !q || [c.rs,c.citta,c.piva,c.ref].join(" ").toLowerCase().includes(q)).slice(0,300);
  $("#cliList").innerHTML = L.length ? `<table class="list"><thead><tr><th>Ragione sociale</th><th>Città</th><th>P.IVA</th><th>Referente</th><th>Contatti</th></tr></thead><tbody>
    ${L.map(c=>`<tr class="click" data-id="${esc(c.id)}"><td><b>${esc(c.rs)}</b></td><td>${esc([c.citta,c.prov&&"("+c.prov+")"].filter(Boolean).join(" "))}</td><td>${esc(c.piva)}</td><td>${esc(c.ref)}</td><td class="hint">${esc([c.tel,c.email].filter(Boolean).join(" · "))}</td></tr>`).join("")}</tbody></table>`
    : `<div class="empty"><b>${q?"Nessun cliente trovato":"Nessun cliente"}</b>Aggiungili con “+ Nuovo” o importa un file Excel/CSV. Puoi anche scrivere il nome direttamente nell'offerta.</div>`;
}
$("#qCli").addEventListener("input", renderClienti);
$("#cliList").addEventListener("click", e => { const tr=e.target.closest("tr[data-id]"); if (tr) editCliente(S.clienti.find(c=>c.id===tr.dataset.id)); });
$("#bNuovoCli").addEventListener("click", () => editCliente(null));
function editCliente(c){
  const nuovo = !c; c = c ? clone(c) : {id:uid()};
  const L = openLayer(`<div class="dialog"><h2>${nuovo?"Nuovo cliente":"Cliente"}</h2><div class="grid g2">
    ${CLI_KEYS.map(k=>`<label class="f${k==="rs"||k==="ind"?" span2":""}">${CLI_LAB[k]}<input data-c="${k}" value="${esc(c[k]||"")}"></label>`).join("")}</div>
    <div class="foot">${nuovo?"":`<button class="btn ghost danger" data-x="del" type="button" style="margin-right:auto">Elimina</button>`}<button class="btn" data-x="no" type="button">Annulla</button><button class="btn primary" data-x="ok" type="button">Salva</button></div></div>`);
  L.addEventListener("click", async e => {
    const x = e.target.closest("[data-x]"); if (!x) return;
    if (x.dataset.x === "no") return closeLayer();
    if (x.dataset.x === "del"){ const {error} = await S.sb.from("wx_clienti").delete().eq("id", c.id); if (error) return toast(errMsg(error)); closeLayer(); await loadClienti(); return toast("Cliente eliminato"); }
    const row = {id:c.id}; $$("[data-c]", L).forEach(i => row[i.dataset.c] = i.value.trim());
    if (!row.rs) return toast("Manca la ragione sociale");
    const {error} = await S.sb.from("wx_clienti").upsert(row); if (error) return toast(errMsg(error));
    closeLayer(); await loadClienti(); toast("Cliente salvato");
  });
}
function parseCSV(t){
  const first = t.split(/\r?\n/)[0] || ""; const sep = (first.match(/;/g)||[]).length >= (first.match(/,/g)||[]).length ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for (let i=0;i<t.length;i++){ const ch=t[i];
    if (q){ if (ch==='"'){ if (t[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; }
    else if (ch==='"') q=true; else if (ch===sep){ row.push(cur); cur=""; } else if (ch==="\n"){ row.push(cur.replace(/\r$/,"")); rows.push(row); row=[]; cur=""; } else cur+=ch; }
  if (cur || row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
$("#fCsv").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try{
    const rows = await righeDaFile(f); if (rows.length < 2) return toast("Il file è vuoto");
    const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z]/g,"");
    const MAP = {rs:["ragionesociale","rs","cliente","nome","denominazione","ragsoc","nominativo"], ind:["indirizzo","via","indirizzosede"], cap:["cap"], citta:["citta","comune","localita"], prov:["provincia","prov","pr"],
      piva:["partitaiva","piva","pi","pivataxid","pivacf","partitaivacodicefiscale"], cf:["codicefiscale","cf"], email:["email","mail","indirizzoemail","emailaddress"], pec:["pec","indirizzopec","emailpec"],
      sdi:["sdi","codicesdi","codicedestinatario"], tel:["telefono","tel","cellulare","telefono1"], ref:["referente","contatto","attenzione"]};
    const head = rows[0].map(norm); const idx = {};
    for (const k in MAP){ const j = head.findIndex(h => MAP[k].includes(h)); if (j >= 0) idx[k] = j; }
    if (idx.rs === undefined) return toast("Colonna 'ragione sociale' o 'denominazione' non trovata nella prima riga");
    const pulisci = v => String(v ?? "").trim().replace(/^"+|"+$/g, "").replace(/\s{2,}/g, " ").trim();
    const chiave = c => (c.piva || c.rs).toLowerCase();
    const esist = new Map(S.clienti.map(c => [chiave(c), c.id]));
    const visti = new Set();
    const out = rows.slice(1).map(r => {
      const g = k => idx[k] !== undefined ? pulisci(r[idx[k]]) : "";
      const c = {}; CLI_KEYS.forEach(k => c[k] = g(k));
      if (!c.piva) c.piva = g("cf");
      if (/^\d{4}$/.test(c.cap)) c.cap = "0" + c.cap;          // Excel toglie lo zero iniziale (04100 -> 4100)
      c.prov = c.prov.toUpperCase().slice(0, 4);
      c.id = esist.get(chiave(c)) || uid(); return c;
    }).filter(c => c.rs && !visti.has(chiave(c)) && visti.add(chiave(c)));
    const agg = out.filter(c => esist.has(chiave(c))).length;
    for (let i=0;i<out.length;i+=500){ const {error} = await S.sb.from("wx_clienti").upsert(out.slice(i,i+500)); if (error) throw error; }
    await loadClienti(); toast(`${out.length - agg} clienti nuovi, ${agg} aggiornati`);
  }catch(err){ toast(errMsg(err)); }
});

/* ---------------------------------------------------------------- listini */
async function renderListini(){
  const vers = await loadVersioni();
  const V = S.versioni.filter(v => v.listino !== "PERSONALE");
  $("#verList").innerHTML = V.length ? `<table class="list"><thead><tr><th>Versione</th><th>Listino</th><th class="r">Righe</th><th></th></tr></thead><tbody>
    ${V.map(v=>`<tr><td><b>${esc(v.versione)}</b>${v.versione===S.settings.versione?' <span class="chip good">in uso</span>':""}</td><td><span class="tag ${esc(v.listino)}">${esc(v.listino)}</span></td><td class="r">${v.righe}</td>
      <td class="r"><button class="btn sm ghost danger" data-delv="${esc(v.versione)}" data-dell="${esc(v.listino)}" type="button">Elimina</button></td></tr>`).join("")}</tbody></table>`
    : `<div class="empty"><b>Nessun listino nel database</b>Premi il pulsante qui sotto per caricare il listino Wildix di Novembre 2026.</div>`;
  $("#selVersione").innerHTML = vers.length ? vers.map(v=>`<option${v===S.settings.versione?" selected":""}>${esc(v)}</option>`).join("") : `<option value="">—</option>`;
  $("#inclusi").innerHTML = LISTINI_INCLUSI.map((l,i)=>`<button class="btn primary" data-inc="${i}" type="button">${vers.includes(l.versione)?"Ricarica":"Carica"} listino incluso: ${esc(l.versione)} (Capex, Opex, Classound)</button>`).join("");
}
$("#verList").addEventListener("click", e => {
  const b = e.target.closest("[data-delv]"); if (!b) return;
  confirmBox(`Eliminare ${b.dataset.dell} ${b.dataset.delv}?`, "Le righe di questo listino vengono tolte dal database. Le offerte già fatte non cambiano (hanno i prezzi copiati dentro).", "Elimina", async () => {
    const {error} = await S.sb.from("wx_listino").delete().eq("versione", b.dataset.delv).eq("listino", b.dataset.dell); if (error) return toast(errMsg(error));
    await renderListini(); await loadListino(); toast("Listino eliminato"); }, true);
});
$("#selVersione").addEventListener("change", async e => { S.settings.versione = e.target.value; await salvaSettings(true); await loadListino(); renderListini(); toast("Listino in uso: " + S.settings.versione); });
async function importaListino(json){
  if (!json || !json.versione || !Array.isArray(json.righe)) throw new Error("File listino non valido");
  const C = json.campi || ["listino","categoria","codice","descrizione","fascia","q_min","q_max","periodo","prezzo_gold","prezzo_eu","ppm_gold","ppm_eu"];
  const seen = new Set();
  const rows = json.righe.map(r => { const o = Array.isArray(r) ? Object.fromEntries(C.map((k,i)=>[k, r[i]])) : r; o.versione = json.versione; o.fascia = o.fascia||""; o.periodo = o.periodo||""; return o; })
    .filter(o => { const k = [o.listino,o.codice,o.fascia].join("|"); if (seen.has(k)) return false; seen.add(k); return ["CAPEX","OPEX","CLASSOUND"].includes(o.listino) && o.codice; });
  const hint = $("#impHint");
  for (let i=0;i<rows.length;i+=400){
    hint.textContent = `Caricamento ${json.versione}: ${Math.min(i+400, rows.length)} / ${rows.length} righe…`;
    const {error} = await S.sb.from("wx_listino").upsert(rows.slice(i,i+400), {onConflict:"versione,listino,codice,fascia"});
    if (error) throw error;
  }
  hint.textContent = `${json.versione}: ${rows.length} righe caricate.`;
  S.settings.versione = json.versione; await salvaSettings(true);
  await renderListini(); await loadListino();
}
$("#inclusi").addEventListener("click", async e => {
  const b = e.target.closest("[data-inc]"); if (!b) return; const l = LISTINI_INCLUSI[+b.dataset.inc]; b.disabled = true;
  try{ const res = await fetch(l.file, {cache:"no-cache"}); if (!res.ok) throw new Error("File " + l.file + " non trovato"); await importaListino(await res.json()); toast("Listino " + l.versione + " caricato"); }
  catch(err){ toast(errMsg(err)); $("#impHint").textContent = errMsg(err); }
  b.disabled = false;
});
$("#fListino").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try{ await importaListino(JSON.parse(await f.text())); toast("Listino caricato"); } catch(err){ toast(errMsg(err)); $("#impHint").textContent = errMsg(err); }
});
const MAT_CAMPI = ["codice","descrizione","categoria","marca","um","prezzo_gold","prezzo_eu","periodo"];
function materiali(){ return S.listino.filter(a => a.listino === "PERSONALE"); }
function renderMiei(){
  const M = materiali();
  const cats = [...new Set(M.map(a=>a.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const selC = $("#qMatCat"), curC = selC.value;
  selC.innerHTML = `<option value="">Ogni categoria</option>` + cats.map(c=>`<option${c===curC?" selected":""}>${esc(c)}</option>`).join("");
  const words = $("#qMat").value.toLowerCase().split(/\s+/).filter(Boolean), cat = selC.value;
  const L = M.filter(a => (!cat || a.categoria === cat) && words.every(w => [a.codice,a.descrizione,a.marca,a.categoria].join(" ").toLowerCase().includes(w)))
             .sort((a,b)=>(a.categoria||"").localeCompare(b.categoria||"") || a.descrizione.localeCompare(b.descrizione));
  $("#matInfo").textContent = M.length ? `${M.length} materiali` : "";
  $("#mieiList").innerHTML = L.length ? `<div class="tablewrap" style="border:0"><table class="list"><thead><tr><th>Codice</th><th>Descrizione</th><th>Marca</th><th>Categoria</th><th>U.M.</th><th>Periodo</th><th class="r">Costo a me</th><th class="r">Prezzo cliente</th><th class="r">Ricarico</th></tr></thead><tbody>
    ${L.slice(0,500).map(a=>`<tr class="click" data-id="${esc(a.id)}"><td><b>${esc(a.codice)}</b></td><td>${esc(a.descrizione)}</td><td>${esc(a.marca)}</td><td>${esc(a.categoria)}</td><td>${esc(a.um)}</td><td>${PER_LAB[a.periodo||""]}</td>
      <td class="r">${eur(a.prezzo_gold)}</td><td class="r">${a.prezzo_eu>0?eur(a.prezzo_eu):'<span class="hint">ricarico std</span>'}</td><td class="r hint">${a.prezzo_eu>0&&a.prezzo_gold>0?n2((a.prezzo_eu/a.prezzo_gold-1)*100)+"%":""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty"><b>${M.length?"Nessun materiale trovato":"Nessun materiale"}</b>${M.length?"":"Aggiungili uno alla volta con “+ Nuovo materiale” o importa un file Excel/CSV."}</div>`;
}
$("#qMat").addEventListener("input", renderMiei);
$("#qMatCat").addEventListener("change", renderMiei);
$("#mieiList").addEventListener("click", e => { const tr=e.target.closest("tr[data-id]"); if (tr) editArticolo(S.listino.find(a=>String(a.id)===tr.dataset.id)); });
$("#bNuovoArt").addEventListener("click", () => editArticolo(null));
function nuovoCodiceMat(){
  let m = 0; materiali().forEach(a => { const x = String(a.codice).match(/^MAT-(\d+)$/); if (x) m = Math.max(m, +x[1]); });
  return "MAT-" + String(m+1).padStart(4, "0");
}
function editArticolo(a, base){
  const nuovo = !a; a = a ? clone(a) : Object.assign({codice:"", descrizione:"", categoria:"", marca:"", um:"", periodo:"", prezzo_gold:"", prezzo_eu:""}, base||{});
  const cats = [...new Set(materiali().map(x=>x.categoria).filter(Boolean))];
  const L = openLayer(`<div class="dialog"><h2>${nuovo?"Nuovo materiale":"Materiale"}</h2><div class="grid g2">
    <label class="f">Codice (vuoto = automatico)<input data-c="codice" value="${esc(a.codice)}"></label>
    <label class="f">Marca<input data-c="marca" value="${esc(a.marca||"")}"></label>
    <label class="f span2">Descrizione<input data-c="descrizione" value="${esc(a.descrizione)}"></label>
    <label class="f">Categoria<input data-c="categoria" list="dlMatCat" value="${esc(a.categoria)}" placeholder="Es. Networking, Cavi, Servizi"><datalist id="dlMatCat">${cats.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label>
    <label class="f">Unità di misura<input data-c="um" value="${esc(a.um||"")}" placeholder="nr., mt., ore…"></label>
    <label class="f">Costo a me<input data-c="prezzo_gold" inputmode="decimal" value="${esc(inN(a.prezzo_gold))}"></label>
    <label class="f">Prezzo al cliente (vuoto = ricarico predefinito)<input data-c="prezzo_eu" inputmode="decimal" value="${esc(num(a.prezzo_eu)>0?inN(a.prezzo_eu):"")}"></label>
    <label class="f">Periodo<select data-c="periodo">${PERIODI.map(([p,l])=>`<option value="${p}"${(a.periodo||"")===p?" selected":""}>${l}</option>`).join("")}</select></label></div>
    <div class="foot">${nuovo?"":`<button class="btn ghost danger" data-x="del" type="button" style="margin-right:auto">Elimina</button>`}<button class="btn" data-x="no" type="button">Annulla</button><button class="btn primary" data-x="ok" type="button">Salva</button></div></div>`);
  L.addEventListener("click", async e => {
    const x = e.target.closest("[data-x]"); if (!x) return;
    if (x.dataset.x === "no") return closeLayer();
    if (x.dataset.x === "del"){ const {error} = await S.sb.from("wx_listino").delete().eq("id", a.id); if (error) return toast(errMsg(error)); closeLayer(); await loadListino(); renderMiei(); return toast("Materiale eliminato"); }
    const row = {}; $$("[data-c]", L).forEach(i => row[i.dataset.c] = i.value.trim());
    if (!row.descrizione) return toast("Serve almeno la descrizione");
    if (!row.codice) row.codice = nuovoCodiceMat();
    row.prezzo_gold = num(row.prezzo_gold); row.prezzo_eu = num(row.prezzo_eu);
    let res;
    if (nuovo) res = await S.sb.from("wx_listino").insert(Object.assign({versione:"Miei", listino:"PERSONALE", fascia:""}, row));
    else res = await S.sb.from("wx_listino").update(row).eq("id", a.id);
    if (res.error) return toast(res.error.code==="23505" ? "Esiste già un materiale con il codice " + row.codice : errMsg(res.error));
    closeLayer(); await loadListino(); renderMiei(); toast("Materiale salvato: " + row.codice);
  });
}
function loadSheetJS(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => { const s=document.createElement("script"); s.src="js/vendor/xlsx.full.min.js";
    s.onload=()=>res(window.XLSX); s.onerror=()=>rej(new Error("Libreria per i file Excel non raggiungibile")); document.head.appendChild(s); });
}
async function righeDaFile(file){
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "xls" || ext === "xlsx"){
    const X = await loadSheetJS(); const wb = X.read(await file.arrayBuffer(), {type:"array"});
    return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:false, defval:""}).map(r=>r.map(x=>String(x))).filter(r=>r.some(x=>x.trim()));
  }
  const buf = new Uint8Array(await file.arrayBuffer()); let t;
  try{ t = new TextDecoder("utf-8",{fatal:true}).decode(buf); }catch(e){ t = new TextDecoder("windows-1252").decode(buf); }
  return parseCSV(t.replace(/^﻿/,""));
}
$("#fMat").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try{
    const rows = await righeDaFile(f); if (rows.length < 2) return toast("Il file è vuoto");
    const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z]/g,"");
    const MAP = {codice:["codice","cod","codicearticolo","articolo","sku","partnumber"], descrizione:["descrizione","desc","prodotto","nome","descrizionearticolo"],
      categoria:["categoria","cat","gruppo","famiglia"], marca:["marca","produttore","brand","fornitore"], um:["um","unita","unitadimisura","unitamisura"],
      prezzo_gold:["costo","costoame","prezzoacquisto","acquisto","costounitario","netto"], prezzo_eu:["prezzo","prezzocliente","prezzovendita","vendita","listino"], periodo:["periodo","ricorrenza"]};
    const head = rows[0].map(norm), idx = {};
    for (const k in MAP){ const j = head.findIndex(h => MAP[k].includes(h)); if (j >= 0) idx[k] = j; }
    if (idx.descrizione === undefined) return toast("Colonna 'descrizione' non trovata nella prima riga");
    const perOf = v => { v = String(v).toLowerCase().replace(/\s/g,""); return /^(1m|mensile|mese)$/.test(v) ? "1m" : /^(1y|annuale|anno)$/.test(v) ? "1y" : /^(5y|5anni)$/.test(v) ? "5y" : ""; };
    const esist = new Set(materiali().map(a => a.codice));
    let seq = +(nuovoCodiceMat().slice(4)) - 1; const visti = new Set();
    const out = rows.slice(1).map(r => {
      const g = k => idx[k] !== undefined ? String(r[idx[k]] ?? "").trim() : "";
      const o = {versione:"Miei", listino:"PERSONALE", fascia:"", codice:g("codice"), descrizione:g("descrizione"), categoria:g("categoria"), marca:g("marca"), um:g("um"),
        prezzo_gold:num(g("prezzo_gold")), prezzo_eu:num(g("prezzo_eu")), periodo: perOf(g("periodo"))};
      if (!o.codice) o.codice = "MAT-" + String(++seq).padStart(4, "0");
      return o;
    }).filter(o => o.descrizione && !visti.has(o.codice) && visti.add(o.codice));
    const agg = out.filter(o => esist.has(o.codice)).length;
    for (let i=0;i<out.length;i+=400){ const {error} = await S.sb.from("wx_listino").upsert(out.slice(i,i+400), {onConflict:"versione,listino,codice,fascia"}); if (error) throw error; }
    await loadListino(); renderMiei(); toast(`${out.length - agg} materiali nuovi, ${agg} aggiornati`);
  }catch(err){ toast(errMsg(err)); }
});
$("#bEspMat").addEventListener("click", () => {
  const q = v => { v = String(v ?? ""); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
  const righe = [["codice","descrizione","categoria","marca","um","costo","prezzo","periodo"]].concat(materiali().map(a => [a.codice, a.descrizione, a.categoria, a.marca, a.um,
    inN(a.prezzo_gold), a.prezzo_eu>0?inN(a.prezzo_eu):"", PER_LAB[a.periodo||""]==="Una tantum"?"":PER_LAB[a.periodo||""].toLowerCase()]));
  const blob = new Blob(["﻿" + righe.map(r => r.map(q).join(";")).join("\r\n")], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "materiali-tcsistem.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
});

/* ---------------------------------------------------------------- impostazioni */
function renderSettings(){
  const s = S.settings, a = s.azienda, c = s.cond;
  $("#sAzNome").value = a.nome; $("#sAzTel").value = a.tel; $("#sAzDet").value = a.dettagli;
  $("#sLogoPrev").src = a.logo || ""; $("#sLogoPrev").hidden = !a.logo; $("#bLogoVia").hidden = !a.logo;
  $("#sSconto").value = inN(s.sconto); $("#sRicarico").value = inN(s.ricarico);
  $("#sValidita").value = c.validita; $("#sIva").value = c.iva; $("#sPagamento").value = c.pagamento; $("#sConsegna").value = c.consegna;
  $("#sDurata").value = c.durata; $("#sGaranzia").value = c.garanzia; $("#sNote").value = c.note;
  $("#sPreset").value = (s.preset||[]).map(p => [p.descr, inN(p.costo), p.periodo||""].join(" ; ")).join("\n");
  $("#sMioNome").value = (S.profilo && S.profilo.nome) || "";
}
$("#sLogo").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const img = new Image(); const rd = new FileReader();
  rd.onload = () => { img.onload = () => { const h = 120, w = Math.round(img.width * h / img.height); const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h); S.settings.azienda.logo = cv.toDataURL("image/png"); $("#sLogoPrev").src = S.settings.azienda.logo; $("#sLogoPrev").hidden = false; $("#bLogoVia").hidden = false; $("#setHint").textContent = "Premi “Salva impostazioni”."; }; img.src = rd.result; };
  rd.readAsDataURL(f);
});
$("#bLogoVia").addEventListener("click", () => { S.settings.azienda.logo = ""; renderSettings(); $("#setHint").textContent = "Premi “Salva impostazioni”."; });
async function salvaSettings(silenzioso){
  const {error} = await S.sb.from("wx_impostazioni").update({dati: clone(S.settings)}).eq("id", 1);
  if (error){ toast(errMsg(error)); return false; }
  if (!silenzioso) toast("Impostazioni salvate"); return true;
}
$("#bSalvaSet").addEventListener("click", async () => {
  const s = S.settings;
  s.azienda.nome = $("#sAzNome").value.trim(); s.azienda.tel = $("#sAzTel").value.trim(); s.azienda.dettagli = $("#sAzDet").value;
  s.sconto = num($("#sSconto").value); s.ricarico = num($("#sRicarico").value);
  Object.assign(s.cond, {validita:+$("#sValidita").value||0, iva:$("#sIva").value, pagamento:$("#sPagamento").value, consegna:$("#sConsegna").value, durata:$("#sDurata").value, garanzia:$("#sGaranzia").value, note:$("#sNote").value});
  s.preset = $("#sPreset").value.split("\n").map(l => l.split(";").map(x=>x.trim())).filter(p => p[0]).map(p => ({descr:p[0], costo:num(p[1]), periodo:["1m","1y","5y"].includes(p[2])?p[2]:""}));
  if (await salvaSettings()){ $("#setHint").textContent = "Salvate. Valgono per le offerte nuove."; fillDatalists(); }
});
$("#bMioNome").addEventListener("click", async () => {
  const nome = $("#sMioNome").value.trim(); if (!nome) return;
  const {error} = await S.sb.from("wx_utenti").update({nome}).eq("user_id", S.user.id); if (error) return toast(errMsg(error));
  S.profilo = Object.assign(S.profilo||{}, {nome}); $("#userName").textContent = nome; toast("Nome salvato");
});

/* ---------------------------------------------------------------- stampa */
function testata(az){
  return `<div class="ph"><div>${az.logo ? `<img class="logo" src="${az.logo}" alt="">` : `<div class="az">${esc(az.nome)}</div>`}</div><div class="det">${az.logo?`<b>${esc(az.nome)}</b><br>`:""}${esc(az.dettagli).replace(/\n/g,"<br>")}</div></div>`;
}
function testataOfferta(o, titolo){
  return `<div class="tit">${titolo}</div>
    <div class="hdr"><div class="box"><small>Spett.le</small>${esc(o.clienteBlocco || o.cliente)}</div>
      <table class="meta"><tr><td>Offerta nr.</td><td>${esc(o.numero)}</td></tr><tr><td>Data</td><td>${fmtDate(o.data)}</td></tr>
      <tr><td>Cortese attenzione</td><td>${esc(o.attenzione)}</td></tr><tr><td>Redatto da</td><td>${esc(o.redatto)}</td></tr></table></div>
    <div class="ogg">OGGETTO: <span>${esc(o.oggetto)}</span></div>`;
}
const GRUPPO_STAMPA = {"":"Fornitura una tantum","1m":"Servizi a canone mensile","1y":"Servizi a canone annuale","5y":"Servizi a canone 5 anni (anticipato)"};
function paperHtml(o){
  const k = calc(o), P = o.parametri, az = S.settings.azienda;
  // righe raggruppate per periodicità: prima la una tantum, poi i canoni; ogni gruppo chiude con il suo totale.
  // I titoli di sezione restano davanti alle righe che seguono, dentro ciascun gruppo.
  const gruppi = {}; PERIODI.forEach(([p]) => gruppi[p] = []);
  let sez = "";
  o.righe.forEach((r,i) => { const c = k.rows[i];
    if (r.tipo === "sez"){ sez = r.descr || ""; return; }
    if (c.filled) gruppi[c.p].push({r, c, sez});
  });
  const usati = PERIODI.filter(([p]) => gruppi[p].length);
  // il prezzo unitario si stampa solo sulle righe una tantum, mai su quelle a canone
  const unit = P.unit && gruppi[""].length > 0;
  const cols = (P.codici?1:0) + 1 + 1 + (unit?1:0) + 1;
  const body = usati.map(([p]) => {
    let ultima = null;
    const righe = gruppi[p].map(({r, c, sez}) => {
      const tit = sez && sez !== ultima ? `<tr class="sez"><td colspan="${cols}">${esc(sez)}</td></tr>` : ""; ultima = sez;
      const en = P.en && r.descrEn && r.descrEn !== r.descr ? `<span class="en">${esc(r.descrEn)}</span>` : "";
      return tit + `<tr>${P.codici?`<td>${esc(r.codice)}</td>`:""}<td>${esc(r.descr).replace(/\n/g,"<br>")}${en}</td><td class="c">${n2(c.qta)}</td>
        ${unit?`<td class="r">${p===""?fmtI.format(c.prezzo)+" €":""}</td>`:""}<td class="r">${p===""?eur(c.tot):""}</td></tr>`;
    }).join("");
    const testa = usati.length > 1 ? `<tr class="grp"><td colspan="${cols}">${GRUPPO_STAMPA[p]}</td></tr>` : "";
    return testa + righe + `<tr class="sub"><td colspan="${cols-1}">${PER_STAMPA[p]} (IVA esclusa)</td><td class="r">${eur(k.per[p].ricavo)}</td></tr>`;
  }).join("");
  const c = o.condizioni, canoni = k.per["1m"].ricavo || k.per["1y"].ricavo || k.per["5y"].ricavo;
  const cond = [["Validità offerta", c.validita ? fmtDate(addDays(o.data, c.validita)) : ""], ["Pagamento", c.pagamento], ["Consegna / attivazione", c.consegna],
    canoni ? ["Durata contratto canoni", c.durata] : null, ["Garanzia", c.garanzia], ["IVA", c.iva]].filter(x => x && x[1]);
  return `<div class="paper">${testata(az)}${testataOfferta(o, "OFFERTA")}
    <table class="pr"><thead><tr>${P.codici?"<th>Codice</th>":""}<th>Descrizione</th><th>Q.tà</th>${unit?"<th>Prezzo unit.</th>":""}<th>Totale</th></tr></thead>
    <tbody>${body || `<tr><td colspan="${cols}" class="c">Nessuna riga compilata</td></tr>`}</tbody></table>
    ${cond.length ? `<h3 style="margin:18px 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.05em">Condizioni di fornitura</h3><table class="cond">${cond.map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>` : ""}
    ${c.note ? `<div class="note">${esc(c.note)}</div>` : ""}
    <p style="margin:12px 0 0">${az.tel ? `Per qualsiasi chiarimento: <b>${esc(az.tel)}</b><br>` : ""}Grazie per averci scelto!</p>
    <div class="firma"><div>Timbro e firma del cliente per accettazione</div></div></div>`;
}
function paperInterno(o){
  const k = calc(o), az = S.settings.azienda;
  const body = o.righe.map((r,i) => { const c = k.rows[i];
    if (r.tipo === "sez") return r.descr ? `<tr class="sez"><td colspan="8">${esc(r.descr)}</td></tr>` : "";
    if (!c.filled) return "";
    return `<tr><td>${esc(r.codice)}${r.fascia?`<br><small>${esc(r.fascia)}</small>`:""}</td><td>${esc(r.descr)}</td><td class="c">${PER_LAB[c.p]}</td><td class="c">${n2(c.qta)}</td>
      <td class="r g">${fmtI.format(c.costo)} €</td><td class="r">${fmtI.format(c.prezzo)} €</td><td class="r g">${eur(c.cTot)}</td><td class="r">${eur(c.tot)}</td><td class="r"><b>${eur(c.marg)}</b></td></tr>`; }).join("");
  const costi = o.costi.filter(c => String(c.descr).trim() || num(c.costo)).map((c,i) => `<tr><td>${esc(c.descr)}</td><td class="c">${PER_LAB[c.periodo||""]}</td><td class="c">${n2(num(c.qta))}</td><td class="r">${fmtI.format(num(c.costo))} €</td><td class="r">${eur(k.costi[o.costi.indexOf(c)])}</td></tr>`).join("");
  const sum = PERIODI.filter(([p]) => k.per[p].ricavo || k.per[p].costoTot).map(([p,l]) => { const g = k.per[p];
    return `<tr><td>${l}</td><td class="r">${eur(g.ricavo)}</td><td class="r">${eur(g.costo)}</td><td class="r">${eur(g.interni)}</td><td class="r"><b>${eur(g.marg)}</b></td><td class="r">${g.ricavo?n2(g.marg/g.ricavo*100)+"%":""}</td></tr>`; }).join("");
  return `<div class="paper">${testata(az)}<div class="interno">DOCUMENTO INTERNO – ANALISI COSTI E MARGINI – NON INVIARE AL CLIENTE</div>${testataOfferta(o, "ANALISI OFFERTA")}
    <table class="pr"><thead><tr><th>Codice</th><th>Descrizione</th><th>Periodo</th><th>Q.tà</th><th>Costo unit.</th><th>Prezzo unit.</th><th>Costo tot.</th><th>Ricavo tot.</th><th>Margine</th></tr></thead><tbody>${body}</tbody></table>
    ${costi ? `<h3 style="margin:16px 0 6px;font-size:13px;text-transform:uppercase">Costi a me non fatturati</h3><table class="pr"><thead><tr><th>Descrizione</th><th>Periodo</th><th>Q.tà</th><th>Costo unit.</th><th>Totale</th></tr></thead><tbody>${costi}</tbody></table>` : ""}
    <h3 style="margin:16px 0 6px;font-size:13px;text-transform:uppercase">Riepilogo</h3>
    <table class="pr"><thead><tr><th>Periodo</th><th>Ricavo</th><th>Costo articoli</th><th>Costi interni</th><th>Margine</th><th>%</th></tr></thead><tbody>${sum}
    <tr class="sez"><td>Primo anno</td><td class="r">${eur(k.ricavo1)}</td><td class="r" colspan="2">${eur(k.costo1)}</td><td class="r">${eur(k.marg1)}</td><td class="r">${n2(k.perc1)}%</td></tr></tbody></table>
    <p class="hint" style="margin-top:8px;color:#555">Listino: ${esc(o.versione||"—")}. Primo anno = una tantum + 12 × mensile + annuale + 5 anni.</p></div>`;
}
function stampa(html, nome){
  $("#printArea").innerHTML = html;
  const prev = document.title; document.title = nome.replace(/[\/\\:*?"<>|]/g, "-");
  setTimeout(() => { window.print(); document.title = prev; }, 80);
}
const nomeFile = (o, pre) => pre + " " + o.numero + (o.cliente ? " - " + o.cliente : "");
$("#bAnteprima").addEventListener("click", () => {
  const L = openLayer(`<div class="dialog wide" style="background:var(--bg)"><div class="row" style="margin-bottom:12px">
      <h2 style="margin:0">Anteprima per il cliente</h2>
      <div class="sp row" style="margin-left:auto"><button class="btn primary" data-x="print" type="button">Stampa / Salva PDF</button><button class="btn" data-x="close" type="button">Chiudi</button></div></div>
      <p class="hint" style="margin:-4px 0 12px">“Stampa / Salva PDF” apre la finestra di stampa: come stampante scegli <b>Salva come PDF</b>. I costi a me non compaiono.</p>
      <div class="paper-wrap">${paperHtml(S.offer)}</div></div>`);
  L.addEventListener("click", e => { const x=e.target.closest("[data-x]"); if(!x) return; if (x.dataset.x==="close") closeLayer(); if (x.dataset.x==="print") stampa(paperHtml(S.offer), nomeFile(S.offer, "Offerta")); });
});
$("#bInterno").addEventListener("click", () => stampa(paperInterno(S.offer), nomeFile(S.offer, "INTERNO Analisi")));

/* ---------------------------------------------------------------- assistenza (ticket) */
const TK_STATI = ["Nuovo","In carico","Pianificato","In attesa cliente","Chiuso"];
const TK_PRIO = ["Bassa","Normale","Alta","Urgente"];
const tkChip = s => s==="Nuovo"?"red":s==="Chiuso"?"good":s==="Pianificato"?"navy":s==="In attesa cliente"?"":"warn";
const prioChip = p => p==="Urgente"?"red":p==="Alta"?"warn":"";
S.ticket = []; S.tecnici = []; S.tkFiltro = "aperti";
async function loadTicket(){
  const {data, error} = await S.sb.from("wx_ticket").select("*").order("created_at", {ascending:false}).range(0, 999);
  if (error){ if (!/does not exist|schema cache/i.test(error.message||"")) toast(errMsg(error)); return; }
  S.ticket = data || [];
  const n = S.ticket.filter(t => t.stato === "Nuovo").length, b = $("#tkBadge");
  b.textContent = n; b.hidden = !n;
  if (!$("#v-assistenza").hidden) renderTicket();
}
async function loadTecnici(){
  const {data} = await S.sb.from("operai").select("nome").order("nome");
  S.tecnici = (data || []).map(o => o.nome).filter(Boolean);
}
function renderTicket(){
  const q = $("#qTk").value.trim().toLowerCase(), f = S.tkFiltro;
  const L = S.ticket.filter(t => (f === "" || (f === "aperti" ? t.stato !== "Chiuso" : t.stato === f)) &&
    (!q || [t.numero,t.cliente,t.richiedente,t.oggetto,t.tecnico,t.descrizione].join(" ").toLowerCase().includes(q)));
  $("#tkList").innerHTML = L.length ? `<div class="tablewrap" style="border:0"><table class="list"><thead><tr><th>Nr.</th><th>Aperto</th><th>Stato</th><th>Priorità</th><th>Cliente / richiedente</th><th>Oggetto</th><th>Tecnico</th><th>Intervento</th><th>Canale</th></tr></thead><tbody>
    ${L.map(t => `<tr class="click" data-id="${esc(t.id)}"><td><b>${esc(t.numero)}</b></td><td class="hint">${new Date(t.created_at).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"})}</td>
      <td><span class="chip ${tkChip(t.stato)}">${esc(t.stato)}</span></td><td>${t.priorita!=="Normale"?`<span class="chip ${prioChip(t.priorita)}">${esc(t.priorita)}</span>`:"Normale"}</td>
      <td>${esc(t.cliente||"—")}${t.richiedente?`<div class="hint">${esc(t.richiedente)}${t.telefono?" · "+esc(t.telefono):""}</div>`:""}</td>
      <td>${esc(t.oggetto)}</td><td>${esc(t.tecnico)}</td><td>${fmtDate(t.data_intervento)}</td><td class="hint">${esc(t.canale)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty"><b>Nessun ticket</b>${f==="aperti"?"Non ci sono richieste aperte.":"Nessun ticket con questo filtro."}</div>`;
}
$("#segTk").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.tkFiltro = b.dataset.f;
  $$("#segTk button").forEach(x => x.setAttribute("aria-pressed", String(x===b))); renderTicket(); });
$("#qTk").addEventListener("input", renderTicket);
$("#bTkAggiorna").addEventListener("click", loadTicket);
$("#tkList").addEventListener("click", e => { const tr = e.target.closest("tr[data-id]"); if (tr) editTicket(S.ticket.find(t => String(t.id) === tr.dataset.id)); });
$("#bNuovoTk").addEventListener("click", () => editTicket(null));
function editTicket(t){
  const nuovo = !t;
  t = t ? clone(t) : {stato:"Nuovo", priorita:"Normale", canale:"manuale", cliente:"", cliente_id:null, richiedente:"", telefono:"", email:"", indirizzo:"", oggetto:"", descrizione:"", tecnico:"", data_intervento:"", note_interne:"", storico:[], rapportino:""};
  const sel = (k, opts) => `<select data-t="${k}">${opts.map(o=>`<option${t[k]===o?" selected":""}>${esc(o)}</option>`).join("")}</select>`;
  const storico = (t.storico||[]).slice().reverse().map(m => `<div class="tkmsg"><small>${new Date(m.quando).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"})} · ${esc(m.chi||"")}</small>${esc(m.testo).replace(/\n/g,"<br>")}</div>`).join("");
  const L = openLayer(`<div class="dialog wide"><div class="row" style="margin-bottom:10px"><h2 style="margin:0">${nuovo?"Nuovo ticket":"Ticket "+esc(t.numero)}</h2>
      ${nuovo?"":`<span class="chip ${tkChip(t.stato)}">${esc(t.stato)}</span><span class="hint">aperto il ${new Date(t.created_at).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"})} da ${esc(t.canale)}</span>`}</div>
    <div class="grid g4">
      <label class="f span2">Cliente<input data-t="cliente" list="dlClienti" value="${esc(t.cliente)}" placeholder="Cerca in anagrafica o scrivi il nome"></label>
      <label class="f">Stato${sel("stato", TK_STATI)}</label>
      <label class="f">Priorità${sel("priorita", TK_PRIO)}</label>
      <label class="f">Richiedente<input data-t="richiedente" value="${esc(t.richiedente)}"></label>
      <label class="f">Telefono<input data-t="telefono" value="${esc(t.telefono)}"></label>
      <label class="f span2">Email<input data-t="email" value="${esc(t.email)}"></label>
      <label class="f span4">Indirizzo intervento<input data-t="indirizzo" value="${esc(t.indirizzo)}"></label>
      <label class="f span4">Oggetto<input data-t="oggetto" value="${esc(t.oggetto)}"></label>
      <label class="f span4">Descrizione del problema<textarea data-t="descrizione" rows="4">${esc(t.descrizione)}</textarea></label>
      <label class="f">Tecnico<input data-t="tecnico" list="dlTecnici" value="${esc(t.tecnico)}"><datalist id="dlTecnici">${S.tecnici.map(n=>`<option value="${esc(n)}">`).join("")}</datalist></label>
      <label class="f">Data intervento<input data-t="data_intervento" type="date" value="${esc(t.data_intervento||"")}"></label>
      <label class="f span2">Rapportino collegato (numero)<input data-t="rapportino" value="${esc(t.rapportino||"")}"></label>
      <label class="f span4">Note interne (non visibili al cliente)<textarea data-t="note_interne" rows="2">${esc(t.note_interne)}</textarea></label>
    </div>
    ${nuovo?"":`<div class="sec-t">Storico</div><div class="row" style="align-items:flex-start"><textarea class="inp" id="tkNota" rows="2" placeholder="Aggiungi una nota allo storico…" style="flex:1"></textarea><button class="btn" data-x="nota" type="button">Aggiungi</button></div><div class="tkstorico">${storico||'<p class="hint">Nessuna voce.</p>'}</div>`}
    <div class="foot">${nuovo?"":`<button class="btn ghost danger" data-x="del" type="button" style="margin-right:auto">Elimina</button>${t.stato!=="Chiuso"?`<button class="btn" data-x="chiudi" type="button">Chiudi ticket</button>`:""}`}
      <button class="btn" data-x="no" type="button">Annulla</button><button class="btn primary" data-x="ok" type="button">Salva</button></div></div>`);
  const leggi = () => { const r = {}; $$("[data-t]", L).forEach(i => r[i.dataset.t] = i.value.trim()); r.data_intervento = r.data_intervento || null;
    const c = S.clienti.find(x => x.rs.toLowerCase() === r.cliente.toLowerCase()); r.cliente_id = c ? c.id : (r.cliente === t.cliente ? t.cliente_id : null);
    if (c && !r.indirizzo) r.indirizzo = [c.ind, c.cap, c.citta, c.prov].filter(Boolean).join(" ");
    if (r.stato === "Chiuso" && t.stato !== "Chiuso") r.chiuso_at = new Date().toISOString();
    if (r.stato === "Nuovo" && (r.tecnico || r.data_intervento)) r.stato = r.data_intervento ? "Pianificato" : "In carico";
    return r; };
  const salva = async (extra) => {
    const r = Object.assign(leggi(), extra || {});
    if (!r.oggetto && !r.descrizione) { toast("Scrivi almeno oggetto o descrizione"); return false; }
    const io = (S.profilo && S.profilo.nome) || S.user.email;
    const cambi = nuovo ? [] : ["stato","tecnico","data_intervento","priorita"].filter(k => String(r[k]||"") !== String(t[k]||"")).map(k => `${k.replace("_"," ")}: ${r[k]||"—"}`);
    let res;
    if (nuovo){
      const {data:num} = await S.sb.rpc("wx_prossimo_ticket");
      r.numero = num || ("T" + Date.now()); r.storico = [{quando:new Date().toISOString(), chi:io, testo:"Ticket inserito a mano"}];
      res = await S.sb.from("wx_ticket").insert(r);
    } else {
      if (cambi.length) r.storico = [...(t.storico||[]), {quando:new Date().toISOString(), chi:io, testo:cambi.join(" · ")}];
      res = await S.sb.from("wx_ticket").update(r).eq("id", t.id);
    }
    if (res.error){ toast(errMsg(res.error)); return false; }
    closeLayer(); await loadTicket(); toast(nuovo ? "Ticket " + r.numero + " creato" : "Ticket salvato"); return true;
  };
  L.addEventListener("click", async e => {
    const x = e.target.closest("[data-x]"); if (!x) return;
    if (x.dataset.x === "no") return closeLayer();
    if (x.dataset.x === "ok") return salva();
    if (x.dataset.x === "chiudi") return salva({stato:"Chiuso"});
    if (x.dataset.x === "nota"){
      const testo = $("#tkNota", L).value.trim(); if (!testo) return;
      const storico = [...(t.storico||[]), {quando:new Date().toISOString(), chi:(S.profilo&&S.profilo.nome)||S.user.email, testo}];
      const {error} = await S.sb.from("wx_ticket").update({storico}).eq("id", t.id); if (error) return toast(errMsg(error));
      t.storico = storico; await loadTicket(); closeLayer(); editTicket(S.ticket.find(z => String(z.id) === String(t.id))); return;
    }
    if (x.dataset.x === "del") return confirmBox("Eliminare il ticket " + t.numero + "?", "Il ticket viene cancellato definitivamente.", "Elimina", async () => {
      const {error} = await S.sb.from("wx_ticket").delete().eq("id", t.id); if (error) return toast(errMsg(error)); await loadTicket(); toast("Ticket eliminato"); }, true);
  });
}
async function openTicket(id){ await loadTicket(); const t = S.ticket.find(x => String(x.id) === String(id)); show("assistenza"); if (t) editTicket(t); else toast("Ticket non trovato"); }

/* ---------------------------------------------------------------- Fatture in Cloud */
async function chiamaFic(body){
  if (S.prova) throw new Error("In modalità prova Fatture in Cloud non è disponibile.");
  const {data, error} = await S.sb.functions.invoke("wx-fic", {body});
  if (error){
    let msg = error.message;
    try{ const b = await error.context.json(); if (b && b.errore) msg = b.errore; }catch(e){}
    if (/Failed to send|not found|404/i.test(msg)) msg = "Il collegamento con Fatture in Cloud non è ancora attivo (funzione wx-fic non installata su Supabase).";
    throw new Error(msg);
  }
  if (data && data.errore) throw new Error(data.errore);
  return data;
}
function ficInfo(){
  const f = S.offer && S.offer.parametri && S.offer.parametri.fic;
  $("#ficInfo").innerHTML = f ? `Proforma <b>${esc(f.numero||"")}</b> creata il ${fmtDate(f.data)}${f.url?` · <a href="${esc(f.url)}" target="_blank" rel="noopener">apri PDF</a>`:""}` : "";
}
$("#bFic").addEventListener("click", () => {
  const o = S.offer, k = calc(o);
  const n = o.righe.filter((r,i) => r.tipo !== "sez" && k.rows[i].filled && num(r.qta)).length;
  if (!n) return toast("L'offerta non ha righe");
  if (!String(o.cliente).trim()) return toast("Manca il cliente");
  const imp = k.per[""].ricavo + k.per["1m"].ricavo + k.per["1y"].ricavo + k.per["5y"].ricavo;
  const gia = o.parametri.fic;
  confirmBox("Creare la proforma in Fatture in Cloud?",
    `${gia ? "Per questa offerta esiste già la proforma " + (gia.numero||"") + ": ne verrà creata un'altra. " : ""}Cliente: ${o.cliente}. ${n} righe (una tantum + primo periodo dei canoni), imponibile ${eur(imp)} + IVA 22%. L'offerta viene prima salvata.`,
    "Crea proforma", async () => {
      const b = $("#bFic"); b.disabled = true; b.textContent = "Creazione in corso…";
      try{
        if (S.dirty || o.isNew) await saveOffer();
        if (S.dirty || o.isNew) throw new Error("Salva l'offerta prima di creare la proforma.");
        const r = await chiamaFic({azione:"proforma", offerta_id:o.id});
        o.parametri.fic = {id:r.id, numero:r.numero, data:r.data, url:r.url};
        S.dirty = true; await saveOffer(); ficInfo();
        toast(`Proforma ${r.numero} creata in Fatture in Cloud${r.cliente_creato ? " (cliente aggiunto in anagrafica)" : ""}`);
      }catch(e){ toast(errMsg(e)); $("#ficInfo").textContent = errMsg(e); }
      b.disabled = false; b.textContent = "Crea proforma in Fatture in Cloud";
    });
});
$("#bFicTest").addEventListener("click", async () => {
  $("#ficTest").textContent = "Verifica…";
  try{ const r = await chiamaFic({azione:"test"}); $("#ficTest").textContent = "Collegato a Fatture in Cloud: " + (r.azienda || "azienda " + r.company_id); }
  catch(e){ $("#ficTest").textContent = errMsg(e); }
});

/* ---------------------------------------------------------------- dialoghi */
function openLayer(html){ const l=$("#layer"); l.innerHTML=`<div class="overlay" role="dialog" aria-modal="true">${html}</div>`; const ov=l.firstChild;
  ov.addEventListener("click", e=>{ if(e.target===ov) closeLayer(); }); const f=$("input, button.primary, button", ov); f&&f.focus(); return ov; }
function closeLayer(){ $("#layer").innerHTML=""; }
document.addEventListener("keydown", e => { if (e.key==="Escape" && $("#layer").firstChild) closeLayer(); });
function confirmBox(title, text, okLabel, onOk, danger){
  const L = openLayer(`<div class="dialog"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="foot"><button class="btn" data-x="no" type="button">Annulla</button><button class="btn ${danger?"primary":"navy"}" data-x="ok" type="button">${esc(okLabel)}</button></div></div>`);
  L.addEventListener("click", e => { const x=e.target.closest("[data-x]"); if(!x) return; closeLayer(); if (x.dataset.x==="ok") onOk(); });
}

/* ---------------------------------------------------------------- accesso e avvio */
const flowHash = location.hash; const vuolePassword = /type=(recovery|invite)/.test(flowHash);
function showLogin(msg){ $("#appRoot").hidden = true; $("#loginRoot").hidden = false; $("#fLogin").hidden = false; $("#fNuovaPwd").hidden = true; $("#lErr").textContent = msg || ""; $("#lEmail").focus(); }
function showNuovaPwd(){ $("#appRoot").hidden = true; $("#loginRoot").hidden = false; $("#fLogin").hidden = true; $("#fNuovaPwd").hidden = false; $("#nPwd").focus(); }
$("#fLogin").addEventListener("submit", async e => {
  e.preventDefault(); $("#lErr").textContent = "";
  const {data, error} = await S.sb.auth.signInWithPassword({email: $("#lEmail").value.trim(), password: $("#lPwd").value});
  if (error) return $("#lErr").textContent = /invalid/i.test(error.message) ? "Email o password errate." : error.message;
  startApp(data.user);
});
$("#bRecupera").addEventListener("click", async () => {
  const email = $("#lEmail").value.trim(); if (!email) return $("#lErr").textContent = "Scrivi prima la tua email.";
  const {error} = await S.sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname});
  $("#lErr").textContent = error ? error.message : "Se l'email è registrata, arriva un link per scegliere una nuova password.";
});
$("#fNuovaPwd").addEventListener("submit", async e => {
  e.preventDefault(); if ($("#nPwd").value !== $("#nPwd2").value) return $("#nErr").textContent = "Le due password non coincidono.";
  const {data, error} = await S.sb.auth.updateUser({password: $("#nPwd").value}); if (error) return $("#nErr").textContent = error.message;
  history.replaceState(null, "", location.pathname); startApp(data.user);
});
$("#bEsci").addEventListener("click", () => guardDirty(async () => { S.dirty = false; await S.sb.auth.signOut(); location.replace(location.pathname); }));

async function startApp(user){
  const acc = await S.sb.rpc("wx_registra_accesso");
  if (acc.error || !acc.data){
    await S.sb.auth.signOut();
    return showLogin(acc.error ? errMsg(acc.error) : "Il tuo utente non è abilitato al preventivatore: chiedi di aggiungere la tua email in wx_utenti.");
  }
  S.user = user;
  const [imp, prof, ut] = await Promise.all([
    S.sb.from("wx_impostazioni").select("dati").eq("id", 1).maybeSingle(),
    S.sb.from("wx_utenti").select("user_id, nome, email").eq("user_id", user.id).maybeSingle(),
    S.sb.from("wx_utenti").select("user_id, nome")
  ]);
  S.settings = deepMerge(DEFAULT_SET, imp.data && imp.data.dati);
  S.profilo = prof.data || {nome: user.email};
  (ut.data||[]).forEach(u => S.utenti[u.user_id] = u.nome);
  $("#userName").textContent = S.profilo.nome || user.email;
  $("#loginRoot").hidden = true; $("#appRoot").hidden = false;
  await loadVersioni();
  await Promise.all([loadListino(), loadClienti(), loadArchivio(), loadTicket(), loadTecnici().catch(()=>{})]);
  fillDatalists();
  const bozza = lsGet(draftKey(), null);
  if (bozza && bozza.righe){ S.offer = bozza; S.dirty = true; toast("Ripresa l'offerta che stavi scrivendo (non salvata)"); }
  else S.offer = newOffer();
  loadOfferIntoForm(); setStatus();
  const h = location.hash.match(/offerta=([0-9a-f-]{36})/i);
  if (h){ history.replaceState(null, "", location.pathname + location.search); S.dirty = false; await openOffer(h[1]); }
  const ht = location.hash.match(/ticket=([0-9a-f-]{36})/i);
  if (ht){ history.replaceState(null, "", location.pathname + location.search); await openTicket(ht[1]); }
  setInterval(() => { if (!document.hidden) loadTicket(); }, 60000);
  if (!S.listino.some(a => a.listino !== "PERSONALE")) banner2("Il database non ha ancora il listino Wildix: vai nella scheda Listini Wildix e premi “Carica listino incluso”.");
}
function banner(t){ const b=$("#banner"); b.textContent=t; b.hidden=false; }
function banner2(t){ const b=$("#banner"); const p=document.createElement("div"); p.id="avvisoListino"; p.textContent=t; p.style.marginTop="4px"; b.appendChild(p); b.hidden=false; }
async function boot(){
  const senzaChiavi = !CFG.SUPABASE_URL || /INCOLLA/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY);
  if ((senzaChiavi || /[?&]prova\b/.test(location.search)) && window.creaClientProva){
    S.sb = window.creaClientProva(); S.prova = true;
    banner("MODALITÀ PROVA: nessun login, i dati restano solo in questo browser. Inserisci le chiavi Supabase in wildix/js/config.js per usarlo davvero. ");
    const az = document.createElement("button"); az.className = "btn sm"; az.type = "button"; az.textContent = "Azzera dati di prova";
    az.addEventListener("click", () => confirmBox("Azzerare i dati di prova?", "Offerte, clienti, listini e impostazioni salvati in questo browser vengono cancellati.", "Azzera", () => { S.sb.azzera(); lsSet(draftKey(), null); S.dirty = false; location.reload(); }, true));
    $("#banner").appendChild(az); $("#bEsci").hidden = true;
    return startApp({id:"prova", email:"prova@locale"});
  }
  if (!window.supabase){ $("#loginRoot").hidden = false; $("#fLogin").hidden = true; $("#loginIntro").textContent = "Impossibile caricare i componenti: controlla la connessione e ricarica la pagina."; return; }
  S.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:"wx-prev-auth"}});
  S.sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") showNuovaPwd(); });
  const {data:{session}} = await S.sb.auth.getSession();
  if (session && vuolePassword) return showNuovaPwd();
  if (session) return startApp(session.user);
  showLogin(/error_description=/.test(flowHash) ? "Il link non è più valido: usa “Password dimenticata?”." : "");
}
window.addEventListener("beforeunload", e => { if (S.dirty && S.offer){ lsSet(draftKey(), S.offer); e.preventDefault(); e.returnValue = ""; } });
boot();
})();
