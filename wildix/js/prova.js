// MODALITÀ PROVA: stesso funzionamento dell'app ma senza login e senza Supabase.
// I dati restano solo nel browser di chi la usa (localStorage).
// Si attiva da sola finché js/config.js ha i segnaposto, oppure aprendo il sito con ?prova
(function(){
  const now = () => new Date(Date.now() + (window.__tick = (window.__tick||0) + 1)).toISOString();
  const KEY = "wx-prev-prova-db";
  const U = {id:"prova", email:"prova@locale"};
  const vuoto = () => ({wx_utenti:[{user_id:"prova", nome:"Prova", email:"prova@locale"}], wx_clienti:[], wx_listino:[], wx_offerte:[], wx_impostazioni:[{id:1, dati:{}}], wx_ticket:[], operai:[{id:1,nome:"Mario Rossi"},{id:2,nome:"Luca Bianchi"}], _seq:1});
  let DB; try{ DB = JSON.parse(localStorage.getItem(KEY)) || vuoto(); }catch(e){ DB = vuoto(); }
  const V0 = vuoto(); for (const k in V0) if (!(k in DB)) DB[k] = V0[k];
  const salva = () => { try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){ console.warn("Spazio del browser pieno", e); } };
  let session = {user:U};
  class Q {
    constructor(t){ this.t=t; this.f=[]; this.op="select"; }
    select(){ return this; }
    insert(r){ this.op="insert"; this.payload=r; return this; }
    update(r){ this.op="update"; this.payload=r; return this; }
    upsert(r, opt){ this.op="upsert"; this.payload=r; this.conflict=(opt&&opt.onConflict)||"id"; return this; }
    delete(){ this.op="delete"; return this; }
    eq(k,v){ this.f.push(r=>String(r[k])===String(v)); return this; }
    in(k,vs){ this.f.push(r=>vs.map(String).includes(String(r[k]))); return this; }
    order(k,o){ this.ord=[k,(o&&o.ascending===false)?-1:1]; return this; }
    limit(n){ this.lim=n; return this; }
    range(a,b){ this.rng=[a,b]; return this; }
    maybeSingle(){ this.single=true; return this; }
    then(res, rej){ try{ const r = this.run(); if (this.op !== "select") salva(); res(r); }catch(e){ rej(e); } }
    run(){
      const T = DB[this.t]; const match = r => this.f.every(f=>f(r)); const cp = o => JSON.parse(JSON.stringify(o));
      if (this.op==="select"){
        let rows = T.filter(match).map(cp);
        if (this.ord) rows.sort((a,b)=> String(a[this.ord[0]]??"").localeCompare(String(b[this.ord[0]]??""), "it", {numeric:true})*this.ord[1]);
        if (this.rng) rows = rows.slice(this.rng[0], this.rng[1]+1);
        if (this.lim) rows = rows.slice(0,this.lim);
        return {data: this.single ? (rows[0]||null) : rows, error:null};
      }
      if (this.op==="insert"){
        const rows = [].concat(this.payload).map(r=>Object.assign({created_by:U.id, updated_by:U.id, created_at:now(), updated_at:now()}, r));
        if (this.t==="wx_offerte") for (const r of rows) if (T.some(x=>x.numero===r.numero)) return {data:null, error:{code:"23505", message:"duplicate key numero"}};
        rows.forEach(r=>{ if (r.id===undefined) r.id = DB._seq++; });
        T.push(...rows); return {data:rows.map(r=>({id:r.id, updated_at:r.updated_at})), error:null};
      }
      if (this.op==="update"){
        const rows = T.filter(match); rows.forEach(r=>Object.assign(r, this.payload, {updated_at:now(), updated_by:U.id}));
        return {data:rows.map(r=>({id:r.id, updated_at:r.updated_at})), error:null};
      }
      if (this.op==="upsert"){
        const keys = this.conflict.split(",").map(s=>s.trim());
        [].concat(this.payload).forEach(r=>{
          const i = T.findIndex(x=>keys.every(k=>String(x[k])===String(r[k])));
          if (i>=0) Object.assign(T[i], r, {updated_at:now()}); else T.push(Object.assign({id: r.id!==undefined ? r.id : DB._seq++, created_at:now(), updated_at:now()}, r));
        });
        return {data:null, error:null};
      }
      if (this.op==="delete"){ for (let i=T.length-1;i>=0;i--) if (match(T[i])) T.splice(i,1); return {data:null, error:null}; }
    }
  }
  window.creaClientProva = function(){ return {
    from: t => new Q(t),
    rpc: async (fn) => {
      if (fn==="wx_registra_accesso") return {data:true, error:null};
      if (fn==="wx_versioni_listino"){
        const m = new Map(); DB.wx_listino.forEach(r=>{ const k=r.versione+"|"+r.listino; m.set(k,(m.get(k)||0)+1); });
        return {data:[...m].map(([k,n])=>{ const [versione,listino]=k.split("|"); return {versione, listino, righe:n}; }), error:null};
      }
      if (fn==="wx_pin_tecnici_impostato") return {data:!!DB._pin, error:null};
      if (fn==="wx_imposta_pin_tecnici"){ DB._pin = true; salva(); return {data:null, error:null}; }
      if (fn==="wx_prossimo_ticket"){
        const yy=String(new Date().getFullYear()).slice(2); let m=0; (DB.wx_ticket||[]).forEach(o=>{ const x=String(o.numero).match(/^T(\d+)-(\d{2})$/); if(x&&x[2]===yy) m=Math.max(m,+x[1]); });
        return {data:`T${String(m+1).padStart(3,"0")}-${yy}`, error:null};
      }
      if (fn==="wx_prossimo_numero"){
        const yy=String(new Date().getFullYear()).slice(2); let m=0;
        DB.wx_offerte.forEach(o=>{ const x=String(o.numero).match(/^P(\d+)-(\d{2})$/); if(x&&x[2]===yy) m=Math.max(m,+x[1]); });
        return {data:`P${String(m+1).padStart(3,"0")}-${yy}`, error:null};
      }
      return {data:null, error:{message:"rpc sconosciuta "+fn}};
    },
    auth: {
      getSession: async () => ({data:{session}}),
      onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
      signInWithPassword: async () => ({data:{user:U}, error:null}),
      signOut: async () => { session=null; return {error:null}; },
      resetPasswordForEmail: async () => ({error:null}),
      updateUser: async () => ({data:{user:U}, error:null})
    },
    azzera(){ DB = vuoto(); salva(); }
  }; };
})();
