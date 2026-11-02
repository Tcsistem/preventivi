
(function(){
"use strict";
/* ---------------------------------------------------------------- dati di base */
const PARAM_DEF = [
  ["ricMat","Ricarico materiale","%"],["manInt","Manodopera interna","€/h"],["manCli","Manodopera cliente","€/h"],
  ["diaria","Diaria","€/gg"],["vitto","Vitto + alloggio","€/gg"],["ricVitto","Ricarico vitto + alloggio","%"],
  ["persImp","Personale impiegato (trasferta a noi)","pers."],["oneri","Oneri della sicurezza","%"]
];
const DEFAULT_SET = {
  parametri:{ricMat:50,manInt:32,manCli:40.5,diaria:15,vitto:100,ricVitto:5,persImp:4,oneri:3},
  pagamenti:["BB 30 GG DFFM","BB 60 GG DFFM","BB 90 GG DFFM","BB 30/60 GG DFFM","BB 30/60/90 GG DFFM","BB 30/60/90/120 GG DFFM","BB 30/60/90/120/150 GG DFFM","BB 30/60/90/120/150/180 GG DFFM","BB 30/60/90/120/150/180/210 GG DFFM","RIBA 30 GG DFFM","RIBA 60 GG DFFM","RIBA 90 GG DFFM","RIBA 30/60 GG DFFM","RIBA 30/60/90 GG DFFM","RIBA 30/60/90/120 GG DFFM","RIBA 30/60/90/120/150 GG DFFM","RIBA 30/60/90/120/150/180 GG DFFM","RIBA 30/60/90/120/150/180/210 GG DFFM","RIBA 30/60/90/120/150/180/210/240 GG DFFM","RIBA 30/60/90/120/150/180/210/240/270 GG DFFM","BB 30 GG DF","BB 60 GG DF","BB 90 GG DF","BB 30/60 GG DF","BB 30/60/90 GG DF","BB 30/60/90/120 GG DF","BB 30/60/90/120/150 GG DF","BB 30/60/90/120/150/180 GG DF","BB 30/60/90/120/150/180/210 GG DF"],
  um:["a.c.","mt.","nr.","ore"],
  fatturazione:["SAL MENSILI","FINE LAVORI"],
  staff:["P. Valiante","G. Giancristofaro","L. Spinazzè","R. Serafino","A. Cristini","C. Tozzato"],
  azienda:{nome:"T.C.S. SRL",dettagli:"Viale P.L. Nervi 246, 04100 Latina\nTel./fax 0773 1740750\nCapitale sociale € 10.000,00 i.v.\nC.F./P.I. 03046890590 – R.E.A. LT 219640\nwww.tcs-impianti.it – info@tcs-impianti.it\nImpianti elettrici civili e industriali · Trasmissione dati · Videosorveglianza",tel:"0773 1740750"}
};
const CLAUSOLE = [
 ["1. Variazioni dell'oggetto del preventivo",["Tutte le modifiche avranno luogo soltanto in seguito all'accordo raggiunto fra le parti circa le conseguenti modificazioni del prezzo contrattuale.","Ogni modifica apportata all'Intervento successivamente alla firma del preventivo deve aver luogo per iscritto ed essere firmata da entrambe le parti.","Parimenti i contraenti convengono espressamente che eventuali varianti in corso d'opera dovranno essere definite, concordate e quantificate tra le parti."]],
 ["2. Prezzo",["Il prezzo complessivo delle opere ammonta ad Euro {TOTALE} oltre I.V.A. di Legge, salvo ricorrano agevolazioni, esenzioni, riduzioni della relativa imposta, i cui presupposti sono da documentarsi a cura e responsabilità del committente.","Le prestazioni sono fatturate al Committente, ed il costo può variare successivamente alla stipulazione del contratto esclusivamente in conseguenza di variazioni delle aliquote Iva o di altri oneri tributari/fiscali direttamente attinenti i lavori da eseguire o le forniture da effettuare."]],
 ["3. Garanzia sui lavori eseguiti e sui materiali",["L'Impresa esegue i lavori oggetto del contratto a regola d'arte secondo le norme tecniche di sicurezza dell'Ente Italiano di Unificazione (UNI) e del Comitato Elettrotecnico Italiano (CEI), nonché nel rispetto di quanto previsto dalla legislazione tecnica vigente in materia.","L'Impresa utilizza ed installa esclusivamente componenti nuovi della miglior qualità; l'eventuale messa a disposizione di componenti nuovi od usati da parte del Committente è soggetta all'approvazione dell'Impresa e del Progettista ove nominato in funzione degli standard qualitativi e di sicurezza vigenti al momento della realizzazione dell'impianto."]],
 ["4. Termine dei lavori. Penali",["I lavori termineranno entro e non oltre il _____________ , salvo varianti concordate che importino modificazione dei termini di consegna.","Qualora per cause ascrivibili alla mancata disponibilità di componenti o ad altre cause al di fuori del controllo dell'Impresa dovessero preannunciarsi ritardi, l'Impresa stessa ne darà immediata comunicazione al Committente.","Nel caso in cui l'impresa ritardi l'inizio o la conclusione dei lavori, salvo caso fortuito o forza maggiore, sarà tollerato un ritardo purché non superiore a 30 giorni solari dalla scadenza fissata."]],
 ["5. Verifica di buon funzionamento dell'impianto e di regolare esecuzione dei lavori – documentazione/certificazioni da consegnare al committente",["Completati i lavori, alla presenza del Committente e/o di un tecnico di sua fiducia, ha luogo la verifica del perfetto funzionamento delle opere realizzate e della regolare esecuzione dei lavori.","Al termine dei lavori l'Impresa è tenuta a consegnare al Committente ai sensi dell'art. 7 del DM 37/2008 la Dichiarazione di Conformità degli Impianti e relativi allegati."]],
 ["6. Recesso",["Il Committente può recedere dal contratto, per motivi propri, mediante adeguata comunicazione. In caso di recesso l'impresa ha diritto al pagamento: delle spese sostenute e documentate sino al momento del recesso, ivi comprese quelle per acquisto di materiali da destinare all'intervento; del corrispettivo di tutti i lavori eseguiti sino al momento del recesso; di un importo percentuale sul prezzo complessivo, da determinarsi di comune accordo tra le parti in relazione allo stato di avanzamento dei lavori."]],
 ["7. Controversie",["Le controversie eventualmente insorte fra Committente ed Impresa installatrice derivanti dal presente preventivo o collegate ad esso – ivi comprese quelle relative alla sua interpretazione, validità, efficacia, esecuzione e risoluzione – potranno essere sottoposte a tentativo di conciliazione presso la Camera di Commercio di Latina."]],
 ["8. Personale impiegato dall'impresa",["L'Impresa, con la sottoscrizione del presente contratto dichiara di impiegare esclusivamente personale con il quale intercorrano contratti di lavoro nel rispetto della legislazione vigente, degli adempimenti previdenziali, assistenziali ed assicurativi.","Nei luoghi interessati all'esecuzione dei lavori l'Impresa adotta ogni prescritta misura di prevenzione di infortuni ed incidenti, anche per quanto concerne i danni al Committente ed a terzi."]]
];

/* ---------------------------------------------------------------- utilità */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { if (v === null || v === undefined || v === "") return 0; const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g,"").replace(",", ".")); return isFinite(n) ? n : 0; };
const numIn = v => { if (v === "" || v === null || v === undefined) return 0; const s=String(v).trim(); const n = parseFloat(s.includes(",") ? s.replace(/\./g,"").replace(",",".") : s); return isFinite(n)?n:0; };
const fmtE = new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"});
const fmtN = new Intl.NumberFormat("it-IT",{maximumFractionDigits:2});
const eur = v => fmtE.format(v||0);
const n2 = v => fmtN.format(v||0);
const today = () => new Date().toISOString().slice(0,10);
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==="x"?r:(r&3|8)).toString(16); });
const clone = o => JSON.parse(JSON.stringify(o));
const fmtDate = iso => { if(!iso) return ""; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const addDays = (iso,n) => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+ (n||0)); return d.toISOString().slice(0,10); };
function lsGet(k,def){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; } }
function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }

/* ---------------------------------------------------------------- stato */
const S = {
  sb:null, user:null, profilo:null,
  settings: clone(DEFAULT_SET),
  clienti: [],         // [{id, rs, ind, cap, citta, prov, piva, cf, email, pec, sdi, ref, tel}]
  offerte: [],         // elenco archivio (senza righe)
  offer: null,         // offerta in modifica
  dirty:false, saving:false,
  setPwd:null          // password impostazioni, solo in memoria finché la pagina è aperta
};
const draftKey = () => "tcs-prev-bozza-" + (S.user ? S.user.id : "");
const defaultCond = () => ({validita:30, garanzia:"12 mesi dal collaudo", consegna:"Da concordare", fatturazione:"FINE LAVORI", pagamento:"BB 90 GG DFFM", iva:"A vs. carico", esclusioni:"Tutto quanto non espresso nel presente preventivo"});

function nextNumero(){
  const y = new Date().getFullYear();
  let max = 0;
  S.offerte.forEach(o => { const m = String(o.numero||"").match(/^(\d{4})\/(\d+)$/); if (m && +m[1]===y) max = Math.max(max, +m[2]); });
  return `${y}/${String(max+1).padStart(3,"0")}`;
}
function newRow(o){ return {id:uid(), um:"", descr:"", qta:"", mat:"", ore:"", pp:""}; }
function newOffer(example){
  const set = S.settings;
  const o = {
    id: uid(), numero: nextNumero(), data: today(), stato:"Bozza",
    clienteId:"", cliente:"", clienteBlocco:"", attenzione:"", redatto:(S.profilo && S.profilo.nome) || "", responsabile:"", oggetto:"",
    modalita:"misura", trasferta:false, parametri: clone(set.parametri),
    righe: [newRow(),newRow(),newRow()],
    condizioni: defaultCond(), esempio: !!example, isNew: true, updatedAt: null
  };
  if (example){
    o.oggetto = "Esempio – Rifacimento illuminazione capannone";
    o.righe = [
      {id:uid(),um:"mt.",descr:"F. e P.O. blindosbarra 546879",qta:25,mat:12.5,ore:6,pp:2},
      {id:uid(),um:"nr.",descr:"F. e P.O. lampade LED 30W",qta:37,mat:8.9,ore:4,pp:4},
      {id:uid(),um:"a.c.",descr:"Collaudo e dichiarazione di conformità DM 37/08",qta:1,mat:0,ore:3,pp:1},
      newRow()
    ];
  }
  return o;
}

/* ---------------------------------------------------------------- calcoli (come il foglio "Offerta (2)") */
function calc(o){
  const p = o.parametri, ric = num(p.ricMat)/100;
  const rows = o.righe.map(r => {
    const qta=num(r.qta), mu=num(r.mat), ore=num(r.ore), pp=num(r.pp);
    const matNoi = mu*qta, muCli = mu*(1+ric), matCli = muCli*qta;
    const manInt = ore*pp*num(p.manInt), manCli = ore*pp*num(p.manCli);
    const tot = matCli + manCli;
    return {qta, mu, ore, pp, matNoi, muCli, matCli, manInt, manCli, tot, posaU: qta ? manCli/qta : 0,
            filled: !!(String(r.descr||"").trim() || qta || tot)};
  });
  const sum = f => rows.reduce((a,r)=>a+r[f],0);
  const ppVals = rows.filter(r=>r.pp>0).map(r=>r.pp);
  const persMedio = ppVals.length ? Math.ceil(ppVals.reduce((a,b)=>a+b,0)/ppVals.length) : 0;
  const oreTot = sum("ore"), oreUomo = rows.reduce((a,r)=>a+r.ore*r.pp,0), gg = oreTot/8;
  const T = o.trasferta;
  const noi = {mat:sum("matNoi"), man:sum("manInt"),
               ind: T ? num(p.diaria)*gg*num(p.persImp) : 0,
               vitto: T ? num(p.vitto)*gg*num(p.persImp) : 0};
  const cli = {mat:sum("matCli"), man:sum("manCli"),
               ind: T ? num(p.diaria)*gg*persMedio : 0,
               vitto: T ? num(p.vitto)*(1+num(p.ricVitto)/100)*gg*persMedio : 0};
  noi.tot = noi.mat+noi.man+noi.ind+noi.vitto;
  cli.tot = cli.mat+cli.man+cli.ind+cli.vitto;
  const imponibile = sum("tot"), oneri = imponibile*num(p.oneri)/100;
  return {rows, persMedio, oreTot, oreUomo, gg, noi, cli, prev:cli.tot, guad:cli.tot-noi.tot,
          imponibile, oneri, totaleOfferta: imponibile+oneri};
}

/* ---------------------------------------------------------------- viste */
function show(view){
  $$(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.view===view)));
  $$(".view").forEach(v => v.hidden = v.id !== "v-"+view);
  if (view==="archivio") renderArchivio();
  if (view==="clienti") renderClienti();
  if (view==="impostazioni") renderSettings();
}
$$(".tab").forEach(t => t.addEventListener("click", () => show(t.dataset.view)));

function setStatus(){
  const dot=$("#dot"), txt=$("#statusText");
  dot.className = "dot " + (S.dirty ? "dirty" : "ok");
  txt.textContent = S.saving ? "Salvataggio…" : S.dirty ? "Modifiche non salvate" : (S.offer && S.offer.isNew ? "Offerta nuova, non ancora salvata" : "Tutto salvato");
}
function markDirty(){ S.dirty = true; lsSet(draftKey(), S.offer); setStatus(); $("#saveHint").textContent = ""; }

/* ---------------------------------------------------------------- editor offerta */
function fillDatalists(){
  $("#dlPag").innerHTML = S.settings.pagamenti.map(v=>`<option value="${esc(v)}">`).join("");
  $("#dlFatt").innerHTML = S.settings.fatturazione.map(v=>`<option value="${esc(v)}">`).join("");
  $("#dlStaff").innerHTML = S.settings.staff.map(v=>`<option value="${esc(v)}">`).join("");
  $("#dlClienti").innerHTML = S.clienti.slice(0,2000).map(c=>`<option value="${esc(c.rs)}">${esc([c.citta,c.piva||c.cf].filter(Boolean).join(" · "))}</option>`).join("");
}
function bloccoCliente(c){
  if (!c) return "";
  const l = [c.rs];
  if (c.ind) l.push(c.ind);
  const cc = [c.cap, c.citta].filter(Boolean).join(" ") + (c.prov ? ` (${c.prov})` : "");
  if (cc.trim()) l.push(cc.trim());
  if (c.piva) l.push("P.Iva: "+c.piva); else if (c.cf) l.push("C.F.: "+c.cf);
  return l.join("\n");
}
function loadOfferIntoForm(){
  const o = S.offer;
  $("#hNum").textContent = o.numero || "";
  $("#hStato").textContent = o.stato; $("#hStato").className = "chip " + chipStato(o.stato);
  $("#oCliente").value = o.cliente; $("#oNumero").value = o.numero; $("#oData").value = o.data;
  $("#oAttenzione").value = o.attenzione; $("#oStato").value = o.stato; $("#oRedatto").value = o.redatto;
  $("#oResp").value = o.responsabile; $("#oOggetto").value = o.oggetto;
  $("#oClienteInfo").textContent = o.clienteBlocco ? o.clienteBlocco.split("\n").slice(1).join(" · ") : (o.cliente ? "Cliente non in anagrafica: in stampa compare solo il nome." : "");
  const c = o.condizioni;
  $("#cValidita").value=c.validita; $("#cGaranzia").value=c.garanzia; $("#cConsegna").value=c.consegna;
  $("#cFatturazione").value=c.fatturazione; $("#cPagamento").value=c.pagamento; $("#cIva").value=c.iva; $("#cEsclusioni").value=c.esclusioni;
  $("#oTrasferta").checked = !!o.trasferta;
  renderParams(); renderRows(); setModo(o.modalita, true); update();
}
function chipStato(s){ return s==="Accettata"?"good":s==="Inviata"?"navy":s==="Persa"?"red":""; }

function bindHeader(){
  const map = {oNumero:"numero",oData:"data",oAttenzione:"attenzione",oRedatto:"redatto",oResp:"responsabile",oOggetto:"oggetto"};
  Object.entries(map).forEach(([id,k]) => $("#"+id).addEventListener("input", e => { S.offer[k]=e.target.value; if(k==="numero") $("#hNum").textContent=e.target.value; markDirty(); }));
  $("#oStato").addEventListener("change", e => { S.offer.stato=e.target.value; $("#hStato").textContent=e.target.value; $("#hStato").className="chip "+chipStato(e.target.value); markDirty(); });
  $("#oCliente").addEventListener("input", e => {
    const v = e.target.value.trim(); S.offer.cliente = v;
    const c = S.clienti.find(x => x.rs.toUpperCase()===v.toUpperCase()) || S.clienti.find(x => x.piva && x.piva===v);
    if (c){ S.offer.clienteId=c.id; S.offer.cliente=c.rs; S.offer.clienteBlocco=bloccoCliente(c); if (e.target.value!==c.rs) e.target.value=c.rs;
            if (!S.offer.attenzione && c.ref){ S.offer.attenzione=c.ref; $("#oAttenzione").value=c.ref; } }
    else { S.offer.clienteId=""; S.offer.clienteBlocco=""; }
    $("#oClienteInfo").textContent = S.offer.clienteBlocco ? S.offer.clienteBlocco.split("\n").slice(1).join(" · ") : (v ? "Cliente non in anagrafica: in stampa compare solo il nome." : "");
    markDirty();
  });
  const cmap = {cValidita:"validita",cGaranzia:"garanzia",cConsegna:"consegna",cFatturazione:"fatturazione",cPagamento:"pagamento",cIva:"iva",cEsclusioni:"esclusioni"};
  Object.entries(cmap).forEach(([id,k]) => $("#"+id).addEventListener("input", e => { S.offer.condizioni[k]= k==="validita" ? numIn(e.target.value) : e.target.value; markDirty(); }));
  $("#oTrasferta").addEventListener("change", e => { S.offer.trasferta = e.target.checked; markDirty(); update(); });
  $("#mMisura").addEventListener("click", () => setModo("misura"));
  $("#mCorpo").addEventListener("click", () => setModo("corpo"));
}
function setModo(m, silent){
  S.offer.modalita = m;
  $("#mMisura").setAttribute("aria-pressed", String(m==="misura"));
  $("#mCorpo").setAttribute("aria-pressed", String(m==="corpo"));
  $("#cardRighe").classList.toggle("corpo", m==="corpo");
  $("#corpoHint").hidden = m!=="corpo";
  $("#chipModo").textContent = m==="corpo" ? "A corpo" : "A misura";
  if (!silent) markDirty();
}

function renderParams(){
  const p = S.offer.parametri, locked = !S.setPwd;
  $("#paramLock").hidden = !locked;
  $("#paramGrid").innerHTML = PARAM_DEF.map(([k,lab,u]) =>
    `<label class="f">${esc(lab)} <span style="text-transform:none;font-weight:400">(${u})</span><input class="num" data-p="${k}" inputmode="decimal" value="${esc(String(p[k]).replace(".",","))}" ${locked?"disabled":""}></label>`).join("");
  $$("#paramGrid input").forEach(inp => inp.addEventListener("input", e => { S.offer.parametri[e.target.dataset.p] = numIn(e.target.value); markDirty(); update(); }));
}

function rowHtml(r, i){
  const ums = S.settings.um.map(u => `<option ${u===r.um?"selected":""}>${esc(u)}</option>`).join("");
  const v = x => (x===""||x===null||x===undefined) ? "" : esc(String(x).replace(".",","));
  return `<tr data-id="${r.id}">
    <td class="idx">${i+1}</td>
    <td class="in" style="width:78px"><select data-k="um" aria-label="Unità di misura"><option value=""></option>${ums}</select></td>
    <td class="in"><textarea data-k="descr" rows="1" aria-label="Descrizione">${esc(r.descr)}</textarea></td>
    <td class="in" style="width:80px"><input class="n" data-k="qta" inputmode="decimal" value="${v(r.qta)}" aria-label="Quantità"></td>
    <td class="in" style="width:110px"><input class="n" data-k="mat" inputmode="decimal" value="${v(r.mat)}" aria-label="Materiale unitario a noi"></td>
    <td class="in" style="width:70px"><input class="n" data-k="ore" inputmode="decimal" value="${v(r.ore)}" aria-label="Ore"></td>
    <td class="in" style="width:76px"><input class="n" data-k="pp" inputmode="decimal" value="${v(r.pp)}" aria-label="Persone"></td>
    <td class="c hide-corpo" data-c="forn"></td><td class="c hide-corpo" data-c="posa"></td><td class="c tot" data-c="tot"></td>
    <td class="act">
      <button class="btn sm ghost" data-a="ins" type="button" title="Inserisci riga sotto" aria-label="Inserisci riga sotto">+</button>
      <button class="btn sm ghost" data-a="up" type="button" title="Sposta su" aria-label="Sposta su">↑</button>
      <button class="btn sm ghost" data-a="down" type="button" title="Sposta giù" aria-label="Sposta giù">↓</button>
      <button class="btn sm ghost danger" data-a="del" type="button" title="Elimina riga" aria-label="Elimina riga">✕</button>
    </td></tr>`;
}
function renderRows(){
  $("#tbRighe").innerHTML = S.offer.righe.map(rowHtml).join("");
}
$("#tbRighe").addEventListener("input", e => {
  const k = e.target.dataset.k; if (!k) return;
  const id = e.target.closest("tr").dataset.id;
  const r = S.offer.righe.find(x => x.id===id); if (!r) return;
  r[k] = (k==="descr"||k==="um") ? e.target.value : e.target.value.trim()==="" ? "" : numIn(e.target.value);
  markDirty(); update();
});
$("#tbRighe").addEventListener("change", e => { if (e.target.dataset.k==="um"){ const r=S.offer.righe.find(x=>x.id===e.target.closest("tr").dataset.id); r.um=e.target.value; markDirty(); }});
$("#tbRighe").addEventListener("click", e => {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const id = b.closest("tr").dataset.id, R = S.offer.righe, i = R.findIndex(x=>x.id===id);
  if (b.dataset.a==="ins") R.splice(i+1,0,newRow());
  if (b.dataset.a==="del"){ R.splice(i,1); if (!R.length) R.push(newRow()); }
  if (b.dataset.a==="up" && i>0) [R[i-1],R[i]]=[R[i],R[i-1]];
  if (b.dataset.a==="down" && i<R.length-1) [R[i+1],R[i]]=[R[i],R[i+1]];
  renderRows(); markDirty(); update();
  if (b.dataset.a==="ins"){ const ta=$$("#tbRighe tr")[i+1]; ta && $("textarea",ta).focus(); }
});
$("#bAddRow").addEventListener("click", () => { S.offer.righe.push(newRow()); renderRows(); markDirty(); update(); const last=$$("#tbRighe tr").pop(); last && $("textarea",last).focus(); });
$("#bSvuota").addEventListener("click", () => confirmBox("Svuotare tutte le righe?", "Descrizioni, quantità, materiale, ore e persone di tutte le righe vengono cancellati. La modalità torna A misura.", "Svuota righe", () => {
  S.offer.righe=[newRow(),newRow(),newRow()]; renderRows(); setModo("misura"); markDirty(); update();
}));

function update(){
  const o = S.offer, k = calc(o);
  $$("#tbRighe tr").forEach((tr, i) => {
    const r = k.rows[i]; if (!r) return;
    tr.querySelector('[data-c="forn"]').textContent = r.muCli ? eur(r.muCli) : "–";
    tr.querySelector('[data-c="posa"]').textContent = r.posaU ? eur(r.posaU) : "–";
    tr.querySelector('[data-c="tot"]').textContent = r.tot ? eur(r.tot) : "–";
  });
  const kv = (rows) => rows.map(([l,v,t]) => `<div class="${t?"t":""}">${l}</div><div class="v ${t?"t":""}">${eur(v)}</div>`).join("");
  $("#kvNoi").innerHTML = kv([["Materiale",k.noi.mat],["Manodopera",k.noi.man],["Indennità trasferta",k.noi.ind],["Vitto + alloggio",k.noi.vitto],["Totale a noi",k.noi.tot,1]]);
  $("#kvCli").innerHTML = kv([["Materiale",k.cli.mat],["Manodopera",k.cli.man],["Indennità trasferta",k.cli.ind],["Vitto + alloggio ricaricato",k.cli.vitto],["Totale con ricarico",k.cli.tot,1]]);
  $("#vPrev").textContent = eur(k.prev);
  $("#vGuad").textContent = eur(k.guad);
  $("#boxGuad").classList.toggle("neg", k.guad < 0);
  $("#trasfHint").textContent = o.trasferta ? `attiva · ${n2(k.gg)} gg × ${k.persMedio} pers. medie` : "non attiva";
  $("#stampaTot").innerHTML = `Totale offerta stampata: <b>${eur(k.totaleOfferta)}</b> (righe ${eur(k.imponibile)} + oneri sicurezza ${n2(o.parametri.oneri)}%)` +
     (o.trasferta && (k.cli.ind+k.cli.vitto) ? `<br><span class="chip warn" style="margin-top:6px">La trasferta (${eur(k.cli.ind+k.cli.vitto)}) non è nel totale stampato</span>` : "");
  $("#kvOre").innerHTML = `<div>Ore totali</div><div class="v">${n2(k.oreTot)}</div><div>Ore × persone</div><div class="v">${n2(k.oreUomo)}</div><div>Giorni totali (ore/8)</div><div class="v">${n2(k.gg)}</div><div>Personale medio</div><div class="v">${k.persMedio}</div>`;
}

/* ---------------------------------------------------------------- salvataggio */
const r2 = v => Math.round((v||0)*100)/100;
function toRow(o){
  const k = calc(o);
  return {numero:String(o.numero).trim(), data:o.data||today(), stato:o.stato, cliente_id:o.clienteId||null, cliente:o.cliente||"",
    cliente_blocco:o.clienteBlocco||"", attenzione:o.attenzione||"", redatto:o.redatto||"", responsabile:o.responsabile||"", oggetto:o.oggetto||"",
    modalita:o.modalita, trasferta:!!o.trasferta, parametri:o.parametri, righe:o.righe, condizioni:o.condizioni,
    tot_offerta:r2(k.totaleOfferta), tot_preventivo:r2(k.prev), guadagno:r2(k.guad)};
}
function fromRow(r){
  return {id:r.id, numero:r.numero, data:r.data, stato:r.stato, clienteId:r.cliente_id||"", cliente:r.cliente||"", clienteBlocco:r.cliente_blocco||"",
    attenzione:r.attenzione||"", redatto:r.redatto||"", responsabile:r.responsabile||"", oggetto:r.oggetto||"", modalita:r.modalita||"misura",
    trasferta:!!r.trasferta, parametri:Object.assign(clone(S.settings.parametri), r.parametri||{}),
    righe:(Array.isArray(r.righe) && r.righe.length ? r.righe : [newRow()]).map(x => Object.assign(newRow(), x, {id:x.id||uid()})),
    condizioni:Object.assign(defaultCond(), r.condizioni||{}), updatedAt:r.updated_at, isNew:false, esempio:false};
}
async function saveOffer(force){
  const o = S.offer;
  if (!String(o.numero||"").trim()){ toast("Scrivi il numero dell'offerta"); $("#oNumero").focus(); return; }
  S.saving = true; setStatus(); $("#bSalva").disabled = true;
  try{
    const row = toRow(o);
    let res;
    if (o.isNew) res = await S.sb.from("prev_offerte").insert(Object.assign({id:o.id}, row)).select("updated_at");
    else {
      let q = S.sb.from("prev_offerte").update(row).eq("id", o.id);
      if (!force && o.updatedAt) q = q.eq("updated_at", o.updatedAt);
      res = await q.select("updated_at");
    }
    if (res.error) throw res.error;
    if (!res.data || !res.data.length){ S.saving=false; setStatus(); $("#bSalva").disabled=false; return conflitto(); }
    o.isNew = false; o.esempio = false; o.updatedAt = res.data[0].updated_at;
    S.dirty = false; lsSet(draftKey(), null);
    $("#saveHint").textContent = "Salvata alle " + new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
    toast("Offerta " + o.numero + " salvata");
    loadArchivio();
  }catch(e){ toast(errMsg(e)); }
  S.saving = false; setStatus(); $("#bSalva").disabled = false;
}
async function conflitto(){
  const {data} = await S.sb.from("prev_offerte").select("id, updated_at, mod:prev_utenti!prev_offerte_updated_by_fkey(nome)").eq("id", S.offer.id).maybeSingle();
  if (!data){ S.offer.isNew = true; return infoBox("Offerta eliminata", "Nel frattempo qualcuno ha eliminato questa offerta dall'archivio. Premi di nuovo “Salva offerta” per salvarla come nuova."); }
  const chi = (data.mod && data.mod.nome) || "un collega";
  const L = openLayer(`<div class="dialog"><h2>Offerta modificata da ${esc(chi)}</h2>
    <p>Dopo che l'hai aperta, ${esc(chi)} ha salvato una versione diversa dell'offerta ${esc(S.offer.numero)} (alle ${new Date(data.updated_at).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}).</p>
    <div class="foot"><button class="btn" data-x="no" type="button">Annulla</button><button class="btn navy" data-x="load" type="button">Apri la sua versione</button><button class="btn primary" data-x="force" type="button">Salva comunque la mia</button></div></div>`);
  L.addEventListener("click", async e => { const x=e.target.closest("[data-x]"); if(!x) return; closeLayer();
    if (x.dataset.x==="force") saveOffer(true);
    if (x.dataset.x==="load") openOffer(S.offer.id, true); });
}
async function withRetry(fn){ return fn(); }
function errMsg(e){
  const c = e && (e.code || e.status);
  if (c==="23505") return "Questo numero di offerta esiste già: cambialo e salva di nuovo.";
  if (c==="28P01") return "Password delle impostazioni errata o cambiata da un collega: sbloccale di nuovo.";
  if (c==="22023") return (e && e.message) || "Valore non valido.";
  if (c==="23503") return "Il cliente scelto non è più in anagrafica: sceglilo di nuovo dall'elenco.";
  if (c==="42501" || c===401 || c===403) return "Accesso scaduto: esci e rientra.";
  if (e && /fetch|network/i.test(e.message||"")) return "Connessione assente: riprova quando sei online.";
  return "Operazione non riuscita: " + ((e && e.message) || "errore sconosciuto");
}
async function prossimoNumero(){
  const {data, error} = await S.sb.rpc("prev_prossimo_numero");
  return error ? nextNumero() : data;
}
$("#bSalva").addEventListener("click", () => saveOffer(false));
$("#bNuova").addEventListener("click", () => guardDirty(async () => {
  S.offer = newOffer(false); S.offer.numero = await prossimoNumero(); S.dirty=false; lsSet(draftKey(), null);
  loadOfferIntoForm(); setStatus(); toast("Nuova offerta " + S.offer.numero);
}));
$("#bDuplica").addEventListener("click", async () => {
  const o = clone(S.offer); o.id = uid(); o.numero = await prossimoNumero(); o.data = today(); o.stato = "Bozza";
  o.isNew = true; o.updatedAt = null; o.esempio = false; o.righe.forEach(r=>r.id=uid());
  S.offer = o; markDirty(); loadOfferIntoForm(); toast("Copia creata come " + o.numero + ": salvala per tenerla");
});
async function openOffer(id, silent){
  const {data, error} = await S.sb.from("prev_offerte").select("*").eq("id", id).maybeSingle();
  if (error) return toast(errMsg(error));
  if (!data) return toast("Offerta non trovata: forse è stata eliminata");
  S.offer = fromRow(data); S.dirty = false; lsSet(draftKey(), null); loadOfferIntoForm(); setStatus(); show("offerta");
  if (!silent) toast("Aperta offerta " + S.offer.numero);
}
function guardDirty(go){
  if (!S.dirty || S.offer.esempio) return go();
  confirmBox("Ci sono modifiche non salvate", "Se continui, le modifiche all'offerta " + (S.offer.numero||"") + " vanno perse.", "Continua senza salvare", go);
}

/* ---------------------------------------------------------------- archivio */
async function loadArchivio(){
  const {data, error} = await S.sb.from("prev_offerte")
    .select("id, numero, data, stato, cliente, oggetto, modalita, trasferta, tot_offerta, guadagno, updated_at, aut:prev_utenti!prev_offerte_created_by_fkey(nome), mod:prev_utenti!prev_offerte_updated_by_fkey(nome)")
    .order("updated_at", {ascending:false}).limit(1000);
  if (error){ toast(errMsg(error)); return; }
  S.offerte = data || [];
  if (!$("#v-archivio").hidden) renderArchivio();
}
function renderArchivio(){
  const q = $("#aCerca").value.trim().toLowerCase();
  const rows = S.offerte.filter(o => !q || [o.numero,o.cliente,o.oggetto,o.stato].join(" ").toLowerCase().includes(q));
  const tb = $("#tArchivio tbody");
  if (!S.offerte.length){ tb.innerHTML = `<tr><td colspan="10"><div class="empty"><b>Nessuna offerta salvata</b>Compila un'offerta e premi “Salva offerta”: comparirà qui, con totale, guadagno e chi l'ha fatta.</div></td></tr>`; return; }
  if (!rows.length){ tb.innerHTML = `<tr><td colspan="10"><div class="empty">Nessuna offerta corrisponde alla ricerca.</div></td></tr>`; return; }
  tb.innerHTML = rows.map(o => `<tr class="click" data-id="${o.id}">
    <td class="num"><b>${esc(o.numero)}</b></td><td class="num">${fmtDate(o.data)}</td><td>${esc(o.cliente)||'<span class="hint">—</span>'}</td>
    <td>${esc(o.oggetto)}</td><td>${o.modalita==="corpo"?"A corpo":"A misura"}${o.trasferta?' <span class="chip warn">trasferta</span>':""}</td>
    <td class="r num">${eur(+o.tot_offerta)}</td><td class="r num">${eur(+o.guadagno)}</td>
    <td><span class="chip ${chipStato(o.stato)}">${esc(o.stato)}</span></td>
    <td class="hint">${esc((o.mod&&o.mod.nome)||(o.aut&&o.aut.nome)||"")}<br>${new Date(o.updated_at).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
    <td><button class="btn sm ghost danger" data-del="${o.id}" type="button" aria-label="Elimina offerta ${esc(o.numero)}">Elimina</button></td></tr>`).join("");
}
$("#aCerca").addEventListener("input", renderArchivio);
$("#tArchivio").addEventListener("click", e => {
  const del = e.target.closest("[data-del]");
  if (del){ e.stopPropagation(); const o = S.offerte.find(x=>x.id===del.dataset.del);
    return confirmBox("Eliminare l'offerta " + o.numero + "?", "L'offerta viene tolta dall'archivio per tutti. Non si può annullare.", "Elimina", async () => {
      const {error} = await S.sb.from("prev_offerte").delete().eq("id", o.id);
      if (error) return toast(errMsg(error));
      if (S.offer && S.offer.id===o.id){ S.offer.isNew = true; S.offer.updatedAt = null; setStatus(); }
      toast("Offerta " + o.numero + " eliminata"); loadArchivio();
    }, true); }
  const tr = e.target.closest("tr.click"); if (!tr) return;
  guardDirty(() => openOffer(tr.dataset.id));
});

/* ---------------------------------------------------------------- clienti */
function renderClienti(){
  const q = $("#cCerca").value.trim().toLowerCase();
  $("#cliCount").textContent = S.clienti.length;
  const tb = $("#tClienti tbody");
  if (!S.clienti.length){ tb.innerHTML = `<tr><td colspan="7"><div class="empty"><b>Nessun cliente in anagrafica</b>Premi “Importa file…” e scegli ELENCO_CLIENTI.xls (o l'export an_clienti del gestionale), oppure aggiungi un cliente a mano.</div></td></tr>`; return; }
  const list = S.clienti.filter(c => !q || [c.rs,c.piva,c.cf,c.citta,c.ind].join(" ").toLowerCase().includes(q)).slice(0,400);
  tb.innerHTML = list.map(c => `<tr class="click" data-id="${c.id}"><td><b>${esc(c.rs)}</b></td><td>${esc(c.ind)}</td><td class="num">${esc(c.cap)}</td><td>${esc(c.citta)}</td><td>${esc(c.prov)}</td><td class="num">${esc(c.piva||c.cf)}</td>
    <td><button class="btn sm ghost" data-use="${c.id}" type="button">Usa in offerta</button></td></tr>`).join("") +
    (list.length===400 ? `<tr><td colspan="7" class="hint">Mostrati i primi 400: usa la ricerca per trovare gli altri.</td></tr>` : "");
}
$("#cCerca").addEventListener("input", renderClienti);
$("#tClienti").addEventListener("click", e => {
  const u = e.target.closest("[data-use]");
  if (u){ const c=S.clienti.find(x=>x.id===u.dataset.use); S.offer.clienteId=c.id; S.offer.cliente=c.rs; S.offer.clienteBlocco=bloccoCliente(c); if(!S.offer.attenzione&&c.ref) S.offer.attenzione=c.ref; markDirty(); loadOfferIntoForm(); show("offerta"); toast(c.rs + " inserito nell'offerta"); return; }
  const tr = e.target.closest("tr.click"); if (tr) editCliente(S.clienti.find(x=>x.id===tr.dataset.id));
});
$("#bNuovoCli").addEventListener("click", () => editCliente(null));
const CLI_FIELDS = [["rs","Ragione sociale","span2"],["piva","P.IVA",""],["cf","Codice fiscale",""],["ind","Indirizzo","span2"],["cap","CAP",""],["citta","Città",""],["prov","Provincia",""],["sdi","Codice SDI",""],["email","Email",""],["pec","PEC",""],["ref","Referente",""],["tel","Telefono",""]];
function editCliente(c){
  const isNew = !c; c = c ? clone(c) : {id:uid()};
  const L = openLayer(`<div class="dialog"><h2>${isNew?"Nuovo cliente":"Modifica cliente"}</h2>
    <div class="grid g4">${CLI_FIELDS.map(([k,l,cls])=>`<label class="f ${cls}">${l}<input data-k="${k}" value="${esc(c[k]||"")}"></label>`).join("")}</div>
    <div class="foot">${isNew?"":'<button class="btn danger" data-x="del" type="button" style="margin-right:auto">Elimina cliente</button>'}
      <button class="btn" data-x="close" type="button">Annulla</button><button class="btn primary" data-x="ok" type="button">Salva cliente</button></div></div>`);
  L.addEventListener("click", async e => {
    const x = e.target.closest("[data-x]"); if (!x) return;
    if (x.dataset.x==="close") return closeLayer();
    if (x.dataset.x==="del"){
      const {error} = await S.sb.from("prev_clienti").delete().eq("id", c.id); if (error) return toast(errMsg(error));
      S.clienti = S.clienti.filter(y=>y.id!==c.id); closeLayer(); renderClienti(); fillDatalists(); return toast("Cliente eliminato"); }
    $$("input[data-k]",L).forEach(i => c[i.dataset.k] = i.value.trim());
    if (!c.rs){ toast("Scrivi la ragione sociale"); return; }
    c.cap = normCap(c.cap); c.piva = normPiva(c.piva); c.prov=(c.prov||"").toUpperCase(); c.cf=(c.cf||"").toUpperCase();
    const {error} = await S.sb.from("prev_clienti").upsert(cliRow(c)); if (error) return toast(errMsg(error));
    const i = S.clienti.findIndex(y=>y.id===c.id); if (i>=0) S.clienti[i]=c; else S.clienti.push(c);
    sortClienti(); closeLayer(); renderClienti(); fillDatalists(); toast("Cliente salvato");
  });
}
function sortClienti(){ S.clienti.sort((a,b)=>a.rs.localeCompare(b.rs,"it")); }
const CLI_KEYS = ["rs","ind","cap","citta","prov","piva","cf","email","pec","sdi","ref","tel"];
function cliRow(c){ const r = {id:c.id}; CLI_KEYS.forEach(k => r[k] = String(c[k]||"").trim()); return r; }
async function loadClienti(){
  let all = [], from = 0;
  for (;;){
    const {data, error} = await S.sb.from("prev_clienti").select("*").order("rs").range(from, from+999);
    if (error){ toast(errMsg(error)); break; }
    all = all.concat(data); if (data.length < 1000) break; from += 1000;
  }
  S.clienti = all.map(r => { const c = {id:r.id}; CLI_KEYS.forEach(k => c[k] = r[k]||""); return c; });
  sortClienti(); fillDatalists(); if (!$("#v-clienti").hidden) renderClienti();
}
async function persistImport(prevIds, replace){
  const rows = S.clienti.map(cliRow);
  for (let i = 0; i < rows.length; i += 500){
    const {error} = await S.sb.from("prev_clienti").upsert(rows.slice(i, i+500)); if (error) throw error;
  }
  if (replace){
    const keep = new Set(rows.map(r => r.id)), drop = prevIds.filter(id => !keep.has(id));
    for (let i = 0; i < drop.length; i += 150){
      const {error} = await S.sb.from("prev_clienti").delete().in("id", drop.slice(i, i+150)); if (error) throw error;
    }
  }
}

/* ----- importazione (stessa logica della macro Excel) */
const syn = {
  rs:["ragionesociale","ragionesociale1","cliente","denominazione","nome","azienda","ditta","societa","nomecliente"],
  ind:["indirizzo","via","sede","sedelegale","indirizzosede"], cap:["cap","codicepostale"], citta:["citta","comune","localita","city"],
  prov:["provincia","prov","pr","siglaprovincia"], piva:["partitaiva","piva","pi","iva","vat","partita"], cf:["codicefiscale","cf","codfiscale","codfisc"],
  email:["email","mail","posta","indirizzoemail"], pec:["pec","emailpec","postacertificata"], sdi:["codicesdi","sdi","codicedestinatario","coddestinatario","coddest","codiceunivoco"],
  ref:["referente","contatto","attenzione","corteseattenzione","persona","riferimento"], tel:["telefono","tel","cellulare","cell","telefono1"]
};
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
const pul = s => String(s??"").replace(/ /g," ").replace(/\s+/g," ").trim();
function normCap(s){ s=String(s||"").replace(/\s/g,""); if (/^\d+$/.test(s) && s.length<5) s=s.padStart(5,"0"); return s; }
function normPiva(s){ s=String(s||"").toUpperCase().replace(/[\s.]/g,""); if (/^IT\d+$/.test(s)) s=s.slice(2); if (/^\d+$/.test(s) && s.length<11) s=s.padStart(11,"0"); return s; }
function parseCSV(t){
  const first = t.split(/\r?\n/)[0]; const cnt = ch => first.split(ch).length-1;
  const sep = [["|",cnt("|")],["\t",cnt("\t")],[",",cnt(",")],[";",cnt(";")]].sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[]; let row=[], f="", q=false;
  for (let i=0;i<t.length;i++){ const ch=t[i];
    if (q){ if (ch==='"'){ if (t[i+1]==='"'){ f+='"'; i++; } else q=false; } else f+=ch; }
    else if (ch==='"') q=true; else if (ch===sep){ row.push(f); f=""; }
    else if (ch==="\n"||ch==="\r"){ if (ch==="\r"&&t[i+1]==="\n") i++; row.push(f); f=""; if (row.some(x=>x.trim())) rows.push(row); row=[]; }
    else f+=ch; }
  row.push(f); if (row.some(x=>x.trim())) rows.push(row);
  return {rows, sep};
}
function loadSheetJS(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => { const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=()=>res(window.XLSX); s.onerror=()=>rej(new Error("Libreria per i file Excel non raggiungibile")); document.head.appendChild(s); });
}
async function readFileRows(file){
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext==="xls"||ext==="xlsx"){
    const X = await loadSheetJS(); const wb = X.read(await file.arrayBuffer(), {type:"array"});
    const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:false, defval:""});
    return {rows: rows.map(r=>r.map(x=>String(x))).filter(r=>r.some(x=>x.trim())), sep:""};
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  let t; try{ t = new TextDecoder("utf-8",{fatal:true}).decode(buf); }catch(e){ t = new TextDecoder("windows-1252").decode(buf); }
  return parseCSV(t.replace(/^﻿/,""));
}
function mapRecords({rows, sep}){
  const head = rows[0]||[]; const map = {}; let rs2 = -1;
  head.forEach((h,i) => { const n=norm(h); if (n==="ragionesociale2") rs2=i; for (const k in syn) if (syn[k].includes(n) && map[k]===undefined) map[k]=i; });
  const out=[]; let dest=0, formato;
  if (map.rs!==undefined){
    formato = "File con intestazioni";
    rows.slice(1).forEach(r => { const c={}; for (const k in map) c[k]=pul(r[map[k]]);
      if (rs2>=0 && pul(r[rs2])) c.rs = (String(r[map.rs]||"").length>=40) ? pul(String(r[map.rs])+String(r[rs2])) : pul(c.rs+" "+r[rs2]);
      out.push(c); });
  } else if (sep==="|" && head.length>=13){
    formato = "Export anagrafica del gestionale (an_clienti)";
    rows.forEach(r => { if (String(r[2]).includes("-")){ dest++; return; }
      const r1=String(r[3]||""), r2=String(r[4]||"");
      out.push({rs: pul(r1.length>=40 ? r1+r2 : r1.trim()+" "+r2.trim()), piva:pul(r[5]), cf:pul(r[6]), cap:pul(r[7]), citta:pul(r[8]), prov:pul(r[9])}); });
  } else return {error:"Formato non riconosciuto: serve una colonna “Ragione Sociale” nella prima riga, oppure l'export an_clienti del gestionale. Prima riga letta: " + head.slice(0,8).join(" | ")};
  out.forEach(c => { c.cap=normCap(c.cap); c.piva=normPiva(c.piva); c.prov=(c.prov||"").toUpperCase(); c.cf=(c.cf||"").toUpperCase();
    if (c.cap==="."||c.cap==="00000") c.cap=""; if (c.piva.length===16 && !/^\d+$/.test(c.piva)){ if(!c.cf) c.cf=c.piva; c.piva=""; } });
  return {formato, records: out.filter(c=>c.rs), scartati: out.filter(c=>!c.rs).length, dest};
}
function trovaPrec(prec, c){
  if (c.piva){ const p = prec.find(x=>x.piva && x.piva.toUpperCase()===c.piva.toUpperCase()); if (p) return p; }
  if (c.cf){ const p = prec.find(x=>x.cf && x.cf.toUpperCase()===c.cf.toUpperCase()); if (p) return p; }
  if (c.piva) return null;
  const N = c.rs.toUpperCase();
  const m = prec.filter(x => { const pn=x.rs.toUpperCase(); return (pn===N || pn.startsWith(N+" ")) && (!c.cap || !x.cap || x.cap===c.cap); });
  return m.length===1 ? m[0] : null;
}
function applyImport(records, replace){
  const prec = S.clienti.map(clone);
  const lista = replace ? [] : S.clienti.map(clone);
  let nuovi=0, agg=0;
  records.forEach(c0 => {
    const c = Object.assign({}, c0);
    const p = trovaPrec(prec, c);
    if (p){ if (p.rs.length > c.rs.length && p.rs.toUpperCase().startsWith(c.rs.toUpperCase())) c.rs = p.rs;
            if (replace) for (const k in p) if (!c[k] && k!=="id") c[k]=p[k]; }
    let t = (c.piva && lista.find(x=>x.piva===c.piva)) || (c.cf && lista.find(x=>x.cf===c.cf)) ||
            lista.find(x=>x.rs.toUpperCase()===c.rs.toUpperCase() && (!c.cap||!x.cap||x.cap===c.cap));
    if (t){ for (const k in c) if (c[k]) t[k]=c[k]; agg++; }
    else { c.id = (p && p.id) || uid(); lista.push(c); nuovi++; }
  });
  S.clienti = lista; sortClienti();
  return {nuovi, agg};
}
$("#bImporta").addEventListener("click", () => $("#fImporta").click());
$("#fImporta").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value=""; if (!file) return;
  let res;
  try{ res = mapRecords(await readFileRows(file)); }catch(err){ return toast(err.message || "File non leggibile"); }
  if (res.error) return infoBox("File non riconosciuto", res.error);
  const L = openLayer(`<div class="dialog"><h2>Importa clienti</h2>
    <p><b>${esc(file.name)}</b> · ${esc(res.formato)}<br>${res.records.length} clienti trovati${res.dest?` · ${res.dest} destinazioni diverse saltate`:""}${res.scartati?` · ${res.scartati} righe senza ragione sociale`:""}.</p>
    <p class="hint">Nomi tagliati a 40 caratteri e persone con solo il cognome vengono completati con l'anagrafica già presente (stessa P.IVA, C.F. o cognome + CAP). I doppioni nel file diventano un cliente solo.</p>
    <div class="grid g2" style="margin-top:10px">
      <button class="btn navy" data-m="agg" type="button" style="justify-content:center;padding:12px">Aggiungi e aggiorna<br>(tiene anche quelli che non sono nel file)</button>
      <button class="btn primary" data-m="sost" type="button" style="justify-content:center;padding:12px">Sostituisci l'elenco<br>(restano solo quelli del file)</button>
    </div>
    <div class="foot"><button class="btn" data-m="x" type="button">Annulla</button></div></div>`);
  L.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-m]"); if (!b) return;
    if (b.dataset.m==="x") return closeLayer();
    const prevIds = S.clienti.map(c => c.id), backup = S.clienti.map(clone);
    $$("button", L).forEach(x => x.disabled = true); b.textContent = "Importazione in corso…";
    const r = applyImport(res.records, b.dataset.m==="sost");
    try{ await persistImport(prevIds, b.dataset.m==="sost"); }
    catch(err){ S.clienti = backup; closeLayer(); await loadClienti(); return infoBox("Importazione non completata", errMsg(err) + " L'elenco mostrato è quello salvato nel database."); }
    closeLayer(); renderClienti(); fillDatalists();
    toast(`Importazione completata: ${r.nuovi} nuovi, ${r.agg} aggiornati · ${S.clienti.length} clienti in elenco`);
  });
});

/* ---------------------------------------------------------------- impostazioni */
async function renderSettings(){
  $("#pNome").value = (S.profilo && S.profilo.nome) || "";
  const unlocked = !!S.setPwd;
  $("#setBody").hidden = !unlocked; $("#setLock").hidden = unlocked;
  if (!unlocked){
    const {data} = await S.sb.rpc("prev_impostazioni_protette");
    const prima = data === false;
    $("#fSblocca").hidden = prima; $("#fPrimaPwd").hidden = !prima;
    $("#lockIntro").textContent = prima
      ? "Le impostazioni non hanno ancora una password: sceglila ora. Da quel momento ricarichi, tariffe, elenchi e intestazione si modificano solo con questa password."
      : "Ricarichi, tariffe, elenchi e intestazione si modificano solo con la password delle impostazioni.";
    (prima ? $("#ppPwd") : $("#sbPwd")).focus();
    return;
  }
  const s = S.settings;
  $("#setParam").innerHTML = PARAM_DEF.map(([k,lab,u]) => `<label class="f">${esc(lab)} <span style="text-transform:none;font-weight:400">(${u})</span><input class="num" data-sp="${k}" inputmode="decimal" value="${esc(String(s.parametri[k]).replace(".",","))}"></label>`).join("");
  $("#sPag").value = s.pagamenti.join("\n"); $("#sUm").value = s.um.join("\n"); $("#sFatt").value = s.fatturazione.join("\n"); $("#sStaff").value = s.staff.join("\n");
  $("#sAzNome").value = s.azienda.nome; $("#sAzDet").value = s.azienda.dettagli; $("#sAzTel").value = s.azienda.tel;
}
async function sblocca(pwd){
  const {data, error} = await S.sb.rpc("prev_verifica_password_impostazioni", {pwd});
  if (error) throw error;
  if (data !== true) return false;
  S.setPwd = pwd; renderParams(); return true;
}
$("#fSblocca").addEventListener("submit", async e => {
  e.preventDefault(); $("#sbErr").textContent = "";
  try{ if (await sblocca($("#sbPwd").value)){ $("#sbPwd").value = ""; renderSettings(); toast("Impostazioni sbloccate"); }
       else $("#sbErr").textContent = "Password errata."; }
  catch(err){ $("#sbErr").textContent = errMsg(err); }
});
$("#fPrimaPwd").addEventListener("submit", async e => {
  e.preventDefault(); $("#ppErr").textContent = "";
  if ($("#ppPwd").value !== $("#ppPwd2").value) return $("#ppErr").textContent = "Le due password non coincidono.";
  const {error} = await S.sb.rpc("prev_imposta_password_impostazioni", {vecchia:null, nuova:$("#ppPwd").value});
  if (error) return $("#ppErr").textContent = errMsg(error);
  S.setPwd = $("#ppPwd").value; $("#ppPwd").value = $("#ppPwd2").value = ""; renderParams(); renderSettings(); toast("Password impostata");
});
$("#fCambiaPwd").addEventListener("submit", async e => {
  e.preventDefault(); $("#cpErr").textContent = "";
  if ($("#cpNew").value !== $("#cpNew2").value) return $("#cpErr").textContent = "Le due password nuove non coincidono.";
  const {error} = await S.sb.rpc("prev_imposta_password_impostazioni", {vecchia:$("#cpOld").value, nuova:$("#cpNew").value});
  if (error) return $("#cpErr").textContent = errMsg(error);
  S.setPwd = $("#cpNew").value; $("#cpOld").value = $("#cpNew").value = $("#cpNew2").value = ""; toast("Password delle impostazioni cambiata: comunicala ai colleghi che la usano");
});
$("#bBlocca").addEventListener("click", () => { S.setPwd = null; renderParams(); renderSettings(); toast("Impostazioni bloccate"); });
$("#bSbloccaParam").addEventListener("click", () => {
  const L = openLayer(`<div class="dialog"><h2>Sblocca i parametri</h2><p class="hint">Serve la password delle impostazioni. Resta sbloccato finché non chiudi la pagina.</p>
    <form id="fSbP" class="row" style="align-items:flex-end"><label class="f" style="flex:1;min-width:200px">Password<input id="spPwd" type="password" autocomplete="off" required></label>
    <button class="btn primary" type="submit">Sblocca</button></form><p class="hint" id="spErr" role="alert"></p>
    <div class="foot"><button class="btn" data-x="no" type="button">Annulla</button></div></div>`);
  setTimeout(() => $("#spPwd").focus(), 0);
  L.addEventListener("click", e => { if (e.target.closest("[data-x]")) closeLayer(); });
  $("#fSbP").addEventListener("submit", async e => { e.preventDefault();
    try{ if (await sblocca($("#spPwd").value)){ closeLayer(); $("#detParams").open = true; toast("Parametri sbloccati"); } else $("#spErr").textContent = "Password errata."; }
    catch(err){ $("#spErr").textContent = errMsg(err); } });
});
$("#bSalvaNome").addEventListener("click", async () => {
  const nome = $("#pNome").value.trim(); if (!nome) return toast("Scrivi il tuo nome");
  const {error} = await S.sb.from("prev_utenti").update({nome}).eq("user_id", S.user.id);
  if (error) return toast(errMsg(error));
  S.profilo.nome = nome; $("#userName").textContent = nome; toast("Nome salvato");
});
$("#bSalvaSet").addEventListener("click", async () => {
  const lines = id => $(id).value.split("\n").map(x=>x.trim()).filter(Boolean);
  const s = S.settings;
  $$("#setParam input").forEach(i => s.parametri[i.dataset.sp] = numIn(i.value));
  s.pagamenti = lines("#sPag"); s.um = lines("#sUm"); s.fatturazione = lines("#sFatt"); s.staff = lines("#sStaff");
  s.azienda = {nome:$("#sAzNome").value.trim(), dettagli:$("#sAzDet").value, tel:$("#sAzTel").value.trim()};
  const {error} = await S.sb.rpc("prev_salva_impostazioni", {pwd: S.setPwd, nuovi: clone(s)});
  if (error){ if (error.code === "28P01"){ S.setPwd = null; renderParams(); renderSettings(); } return toast(errMsg(error)); }
  $("#setHint").textContent = "Salvate. Valgono per le offerte nuove."; fillDatalists(); renderRows(); update(); toast("Impostazioni salvate");
});

/* ---------------------------------------------------------------- anteprima e file di stampa */
function paperHtml(o){
  const k = calc(o), corpo = o.modalita==="corpo", az = S.settings.azienda;
  const righe = o.righe.map((r,i)=>({r, c:k.rows[i]})).filter(x=>x.c.filled);
  const blocco = o.clienteBlocco || o.cliente || "";
  const head = `<div class="ph"><div class="az">${esc(az.nome)}</div><div class="det">${esc(az.dettagli).replace(/\n/g,"<br>")}</div></div>`;
  const p1 = `<div class="paper">${head}
    <div class="tit">OFFERTA</div>
    <div class="hdr"><div class="box"><small>Spett.le</small>${esc(blocco)}</div>
      <table class="meta"><tr><td>Data</td><td>${fmtDate(o.data)}</td></tr><tr><td>Offerta nr.</td><td>${esc(o.numero)}</td></tr>
      <tr><td>Cortese attenzione</td><td>${esc(o.attenzione)}</td></tr><tr><td>Redatto da</td><td>${esc(o.redatto)}</td></tr><tr><td>Responsabile commessa</td><td>${esc(o.responsabile)}</td></tr></table></div>
    <div class="ogg">OGGETTO: <span>${esc(o.oggetto)}</span></div>
    <table class="pr"><thead><tr><th>Riga</th><th>Q.tà</th><th>U.M.</th><th>Descrizione</th>${corpo?"":"<th>Fornitura</th><th>Posa</th><th>Totale</th>"}</tr></thead><tbody>
    ${righe.map((x,i)=>`<tr><td class="c">${i+1}</td><td class="c">${x.c.qta?n2(x.c.qta):""}</td><td class="c">${esc(x.r.um)}</td><td>${esc(x.r.descr)}</td>${corpo?"":`<td class="r">${eur(x.c.muCli)}</td><td class="r">${eur(x.c.posaU)}</td><td class="r">${eur(x.c.tot)}</td>`}</tr>`).join("") || `<tr><td colspan="${corpo?4:7}" class="c">Nessuna riga compilata</td></tr>`}
    </tbody></table>
    <table class="tots"><tr><td>Totale IVA esclusa</td><td class="r">${eur(k.imponibile)}</td></tr><tr><td>Oltre oneri della sicurezza (${n2(o.parametri.oneri)}%)</td><td class="r">${eur(k.oneri)}</td></tr>
    <tr class="g"><td>Totale offerta comprensiva di oneri sicurezza (IVA esclusa)</td><td class="r">${eur(k.totaleOfferta)}</td></tr></table>
    <div class="pagnum">Pag. 1 di 2</div></div>`;
  const c = o.condizioni;
  const p2 = `<div class="paper">${head}
    <h3 style="margin:14px 0 6px;font-size:15px;text-transform:uppercase;letter-spacing:.05em">Condizioni di fornitura</h3>
    <table class="cond"><tr><td>Validità offerta</td><td>${fmtDate(addDays(o.data,c.validita))}</td></tr><tr><td>Garanzia</td><td>${esc(c.garanzia)}</td></tr>
    <tr><td>Consegna</td><td>${esc(c.consegna)}</td></tr><tr><td>Fatturazione</td><td>${esc(c.fatturazione)}</td></tr><tr><td>Modalità di pagamento</td><td>${esc(c.pagamento)}</td></tr>
    <tr><td>IVA</td><td>${esc(c.iva)}</td></tr><tr><td>Esclusioni</td><td>${esc(c.esclusioni)}</td></tr></table>
    <p style="margin:12px 0 0">Per qualsiasi chiarimento sull'offerta, contattare: <b>${esc(az.tel)}</b><br>Grazie per averci scelto!</p>
    <div class="clausole">${CLAUSOLE.map(([t,ps])=>`<h4>${esc(t.toUpperCase())}</h4>${ps.map(x=>`<p>${esc(x).replace("{TOTALE}", eur(k.totaleOfferta).replace("€","").trim())}</p>`).join("")}`).join("")}</div>
    <div class="firma"><div>Il cliente per accettazione</div></div>
    <div class="pagnum">Pag. 2 di 2</div></div>`;
  return p1 + p2;
}
$("#bAnteprima").addEventListener("click", () => {
  const L = openLayer(`<div class="dialog wide" style="background:var(--bg)"><div class="row" style="margin-bottom:12px">
      <h2 style="margin:0">Anteprima di stampa</h2><span class="chip">${S.offer.modalita==="corpo"?"A corpo":"A misura"}</span>
      <div class="sp row" style="margin-left:auto"><button class="btn primary" data-x="print" type="button">Stampa / PDF</button><button class="btn" data-x="close" type="button">Chiudi</button></div></div>
      <p class="hint" style="margin:-4px 0 12px">Solo le righe compilate. “Stampa / PDF” apre la finestra di stampa: scegli la stampante oppure “Salva come PDF”.</p>
      <div class="paper-wrap">${paperHtml(S.offer)}</div></div>`);
  L.addEventListener("click", e => { const x=e.target.closest("[data-x]"); if(!x) return; if (x.dataset.x==="close") closeLayer(); if (x.dataset.x==="print") stampa(); });
});
function stampa(){
  if (S.offer.trasferta) {
    const k = calc(S.offer);
    if (k.cli.ind + k.cli.vitto > 0 && !stampa.ok){
      return confirmBox("La trasferta è attiva", "Indennità " + eur(k.cli.ind) + " e vitto/alloggio " + eur(k.cli.vitto) + " sono nei conti ma non nel totale stampato. Serve la trasferta per questa offerta?", "Sì, stampa", () => { stampa.ok = true; stampa(); stampa.ok = false; });
    }
  }
  $("#printArea").innerHTML = paperHtml(S.offer);
  const prev = document.title; document.title = ("Offerta " + S.offer.numero + (S.offer.cliente ? " - " + S.offer.cliente : "")).replace(/[\/\\:*?"<>|]/g, "-");
  setTimeout(() => { window.print(); document.title = prev; }, 50);
}

/* ---------------------------------------------------------------- dialoghi */
function openLayer(html){ const l=$("#layer"); l.innerHTML=`<div class="overlay" role="dialog" aria-modal="true">${html}</div>`; const ov=l.firstChild;
  ov.addEventListener("click", e=>{ if(e.target===ov) closeLayer(); }); const f=$("button.primary, button", ov); f&&f.focus(); return ov; }
function closeLayer(){ $("#layer").innerHTML=""; }
document.addEventListener("keydown", e => { if (e.key==="Escape" && $("#layer").firstChild) closeLayer(); });
function confirmBox(title, text, okLabel, onOk, danger){
  const L = openLayer(`<div class="dialog"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="foot"><button class="btn" data-x="no" type="button">Annulla</button><button class="btn ${danger?"primary":"navy"}" data-x="ok" type="button">${esc(okLabel)}</button></div></div>`);
  L.addEventListener("click", e => { const x=e.target.closest("[data-x]"); if(!x) return; closeLayer(); if (x.dataset.x==="ok") onOk(); });
}
function infoBox(title, text){ const L=openLayer(`<div class="dialog"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="foot"><button class="btn" data-x="ok" type="button">Ho capito</button></div></div>`); L.addEventListener("click", e=>{ if(e.target.closest("[data-x]")) closeLayer(); }); }

/* ---------------------------------------------------------------- accesso e avvio */
const CFG = window.PREVENTIVI_CONFIG || {};
const flowHash = location.hash;    // letto prima che il client lo consumi
const vuolePassword = /type=(recovery|invite|signup)/.test(flowHash);

function showLogin(msg){ $("#appRoot").hidden = true; $("#loginRoot").hidden = false; $("#fLogin").hidden = false; $("#fNuovaPwd").hidden = true; $("#lErr").textContent = msg || ""; $("#lEmail").focus(); }
function showNuovaPwd(){ $("#appRoot").hidden = true; $("#loginRoot").hidden = false; $("#fLogin").hidden = true; $("#fNuovaPwd").hidden = false;
  $("#loginIntro").textContent = "Scegli la tua password per entrare."; $("#nPwd").focus(); }

$("#fLogin").addEventListener("submit", async e => {
  e.preventDefault(); $("#lErr").textContent = "";
  const {data, error} = await S.sb.auth.signInWithPassword({email: $("#lEmail").value.trim(), password: $("#lPwd").value});
  if (error) return $("#lErr").textContent = /invalid/i.test(error.message) ? "Email o password non corretti." : error.message;
  startApp(data.user);
});
$("#bRecupera").addEventListener("click", async () => {
  const email = $("#lEmail").value.trim();
  if (!email) return $("#lErr").textContent = "Scrivi prima la tua email, poi premi di nuovo “Password dimenticata?”.";
  const {error} = await S.sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname});
  $("#lErr").textContent = error ? error.message : "Se l'email è registrata, ti arriva un link per scegliere una nuova password.";
});
$("#fNuovaPwd").addEventListener("submit", async e => {
  e.preventDefault();
  if ($("#nPwd").value !== $("#nPwd2").value) return $("#nErr").textContent = "Le due password non coincidono.";
  const {data, error} = await S.sb.auth.updateUser({password: $("#nPwd").value});
  if (error) return $("#nErr").textContent = error.message;
  history.replaceState(null, "", location.pathname);
  startApp(data.user);
});
$("#bEsci").addEventListener("click", () => guardDirty(async () => { S.dirty = false; await S.sb.auth.signOut(); location.replace(location.pathname); }));

async function startApp(user){
  const acc = await S.sb.rpc("prev_registra_accesso");
  if (acc.error || acc.data !== true){
    await S.sb.auth.signOut();
    return showLogin(acc.error ? errMsg(acc.error) : "Il tuo utente (" + (user.email||"") + ") non è abilitato ai preventivi. Chiedi all'amministratore di aggiungerti.");
  }
  S.user = user;
  $("#loginRoot").hidden = true; $("#appRoot").hidden = false;
  const [set, prof] = await Promise.all([
    S.sb.from("prev_impostazioni").select("dati").eq("id", 1).maybeSingle(),
    S.sb.from("prev_utenti").select("user_id, nome, email").eq("user_id", user.id).maybeSingle()
  ]);
  if (set.data && set.data.dati) S.settings = Object.assign(clone(DEFAULT_SET), set.data.dati);
  S.profilo = prof.data || {id:user.id, nome:(user.email||"").split("@")[0]};
  $("#userName").textContent = S.profilo.nome || user.email;
  bindHeader(); fillDatalists();
  const bozza = lsGet(draftKey(), null);
  if (bozza && bozza.righe){ S.offer = bozza; S.dirty = true; toast("Ripresa l'offerta che stavi compilando (non salvata)"); }
  else { S.offer = newOffer(false); S.offer.numero = await prossimoNumero(); S.dirty = false; }
  loadOfferIntoForm(); setStatus();
  loadClienti(); loadArchivio();
}

function banner(t){ const b=$("#banner"); b.textContent=t; b.hidden=false; }
async function boot(){
  const senzaChiavi = !CFG.SUPABASE_URL || /INCOLLA/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY);
  if ((senzaChiavi || /[?&]prova\b/.test(location.search)) && window.creaClientProva){
    S.sb = window.creaClientProva(); S.prova = true;
    banner("MODALITÀ PROVA: nessun login, i dati restano solo su questo computer (in questo browser). ");
    const az = document.createElement("button"); az.className = "btn sm"; az.type = "button"; az.textContent = "Azzera dati di prova";
    az.addEventListener("click", () => confirmBox("Azzerare i dati di prova?", "Offerte, clienti e impostazioni salvati in questo browser vengono cancellati.", "Azzera", () => { S.sb.azzera(); lsSet(draftKey(), null); S.dirty = false; location.reload(); }, true));
    $("#banner").appendChild(az);
    $("#bEsci").hidden = true;
    return startApp({id:"prova", email:"prova@locale"});
  }
  if (!window.supabase){
    $("#loginRoot").hidden = false; $("#fLogin").hidden = true;
    $("#loginIntro").textContent = "Impossibile caricare i componenti: controlla la connessione e ricarica la pagina.";
    return;
  }
  S.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  S.sb.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") showNuovaPwd(); });
  const {data:{session}} = await S.sb.auth.getSession();
  if (session && vuolePassword) return showNuovaPwd();
  if (session) return startApp(session.user);
  showLogin(/error_description=/.test(flowHash) ? "Il link non è più valido: chiedi un nuovo invito o usa “Password dimenticata?”." : "");
}
window.addEventListener("beforeunload", e => { if (S.dirty && S.offer && !S.offer.esempio){ lsSet(draftKey(), S.offer); e.preventDefault(); e.returnValue = ""; } });
boot();
})();
