// MODALITÀ PROVA: stesso funzionamento dell'app ma senza login e senza Supabase.
// I dati restano solo nel browser di chi la usa (localStorage) e non vanno su internet.
// Si attiva da sola finché js/config.js non ha le chiavi, oppure aprendo il sito con ?prova
(function(){
  const now = () => new Date(Date.now() + (window.__tick = (window.__tick||0) + 1)).toISOString();
  const KEY = "tcs-prev-prova-db";
  const U = {id:"prova", email:"prova@locale"};
  const vuoto = () => ({prev_utenti:[{user_id:"prova", nome:"Prova", email:"prova@locale"}], prev_clienti:[], prev_offerte:[], prev_impostazioni:[{id:1, dati:{}}]});
  let DB; try{ DB = JSON.parse(localStorage.getItem(KEY)) || vuoto(); }catch(e){ DB = vuoto(); }
  const salva = () => { try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){} };
  let session = {user:U};
  function embed(table, row, cols){
    const out = Object.assign({}, row);
    const re = /(\w+):prev_utenti!prev_offerte_(created|updated)_by_fkey\(nome\)/g; let m;
    while ((m = re.exec(cols||""))){ const pid = row[m[2]+"_by"]; const p = DB.prev_utenti.find(x=>x.user_id===pid); out[m[1]] = p ? {nome:p.nome} : null; }
    return out;
  }
  class Q {
    constructor(t){ this.t=t; this.f=[]; this.op="select"; this.cols="*"; this.wantRows=false; }
    select(c){ if (this.op==="select") this.cols=c||"*"; else this.wantRows=true; this.retCols=c; return this; }
    insert(r){ this.op="insert"; this.payload=r; return this; }
    update(r){ this.op="update"; this.payload=r; return this; }
    upsert(r){ this.op="upsert"; this.payload=r; return this; }
    delete(){ this.op="delete"; return this; }
    eq(k,v){ this.f.push(r=>String(r[k])===String(v)); return this; }
    in(k,vs){ this.f.push(r=>vs.includes(r[k])); return this; }
    order(k,o){ this.ord=[k,(o&&o.ascending===false)?-1:1]; return this; }
    limit(n){ this.lim=n; return this; }
    range(a,b){ this.rng=[a,b]; return this; }
    maybeSingle(){ this.single=true; return this; }
    then(res, rej){ try{ const r = this.run(); if (this.op !== "select") salva(); res(r); }catch(e){ rej(e); } }
    run(){
      const T = DB[this.t]; const match = r => this.f.every(f=>f(r));
      if (this.op==="select"){
        let rows = T.filter(match).map(r=>embed(this.t,r,this.cols));
        if (this.ord) rows.sort((a,b)=> String(a[this.ord[0]]).localeCompare(String(b[this.ord[0]]))*this.ord[1]);
        if (this.rng) rows = rows.slice(this.rng[0], this.rng[1]+1);
        if (this.lim) rows = rows.slice(0,this.lim);
        return {data: this.single ? (rows[0]||null) : rows, error:null};
      }
      if (this.op==="insert"){
        const rows = [].concat(this.payload).map(r=>Object.assign({created_by:U.id, updated_by:U.id, created_at:now(), updated_at:now()}, r));
        if (this.t==="prev_offerte") for (const r of rows) if (T.some(x=>x.numero===r.numero)) return {data:null, error:{code:"23505", message:"duplicate"}};
        T.push(...rows); return {data:rows.map(r=>({updated_at:r.updated_at})), error:null};
      }
      if (this.op==="update"){
        const rows = T.filter(match); rows.forEach(r=>Object.assign(r, this.payload, {updated_at:now(), updated_by:U.id}));
        return {data:rows.map(r=>({updated_at:r.updated_at})), error:null};
      }
      if (this.op==="upsert"){
        [].concat(this.payload).forEach(r=>{ const i=T.findIndex(x=>x.id===r.id); if(i>=0) Object.assign(T[i], r); else T.push(Object.assign({created_at:now()}, r)); });
        return {data:null, error:null};
      }
      if (this.op==="delete"){ for (let i=T.length-1;i>=0;i--) if (match(T[i])) T.splice(i,1); return {data:null, error:null}; }
    }
  }
  window.creaClientProva = function(){ return {
    from: t => new Q(t),
    rpc: async (fn, args) => {
      const I = DB.prev_impostazioni[0]; if (fn==="prev_registra_accesso") return {data:true,error:null}; fn = fn.replace(/^prev_/,"");
      if (fn==="impostazioni_protette") return {data: !!I.pwd, error:null};
      if (fn==="verifica_password_impostazioni") return {data: !!I.pwd && args.pwd===I.pwd, error:null};
      if (fn==="imposta_password_impostazioni"){ if (I.pwd && args.vecchia!==I.pwd) return {data:null,error:{code:"28P01",message:"Password errata"}}; I.pwd=args.nuova; salva(); return {data:null,error:null}; }
      if (fn==="salva_impostazioni"){ if (!I.pwd || args.pwd!==I.pwd) return {data:null,error:{code:"28P01",message:"Password errata"}}; I.dati=args.nuovi; salva(); return {data:null,error:null}; } const y=new Date().getFullYear(); let m=0; DB.prev_offerte.forEach(o=>{ const x=String(o.numero).match(/^(\d{4})\/(\d+)$/); if(x&&+x[1]===y) m=Math.max(m,+x[2]); }); return {data:`${y}/${String(m+1).padStart(3,"0")}`, error:null}; },
    auth: {
      getSession: async () => ({data:{session}}),
      onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
      signInWithPassword: async ({email,password}) => password==="giusta" ? (session={user:U}, {data:{user:U}, error:null}) : {data:{}, error:{message:"Invalid login credentials"}},
      signOut: async () => { session=null; return {error:null}; },
      resetPasswordForEmail: async () => ({error:null}),
      updateUser: async () => ({data:{user:U}, error:null})
    },
    azzera(){ DB = vuoto(); salva(); }
  }; };
})();
