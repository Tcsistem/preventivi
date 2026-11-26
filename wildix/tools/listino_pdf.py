#!/usr/bin/env python3
"""Converte i PDF dei listini Wildix Gold (Capex, Opex, CLASSOUND) nel file .json
che si importa dalla scheda Listini del preventivatore.

Uso:
  pip install pdfplumber
  python3 listino_pdf.py "Dicembre 2026" Gold_Capex.pdf Gold_Opex.pdf Gold_CLASSOUND.pdf -o listino-2026-12.json

Il tipo di listino si riconosce dal nome del file (Capex / Opex / CLASSOUND).
"""
import argparse, json, re, sys
import pdfplumber

def money(s):
    s = (s or "").replace("€", "").replace(",", "").strip()
    try: return float(s)
    except ValueError: return None

def tipo_da_nome(path):
    n = path.lower()
    if "classound" in n: return "CLASSOUND"
    if "opex" in n: return "OPEX"
    if "capex" in n: return "CAPEX"
    sys.exit(f"Non capisco che listino è {path}: il nome deve contenere Capex, Opex o CLASSOUND")

def leggi(path, lst):
    out, cat = [], None
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            tabs = pg.find_tables()
            for tb in tabs:
                top = tb.bbox[1]
                y0 = max([t.bbox[3] for t in tabs if t.bbox[3] <= top], default=0)
                if top - y0 > 2 and top > 0:
                    txt = pg.crop((0, max(y0, 0), pg.width, top)).extract_text() or ""
                    righe = [l.strip() for l in txt.split("\n") if l.strip() and not re.match(r"Gold -|\w+ \d{4}$", l.strip())]
                    if righe: cat = righe[-1]
                for r in tb.extract():
                    r = [(c or "").replace("\n", " ").strip() for c in r]
                    if r[0] == "Product Code": continue
                    if r[0] and not any(r[1:]): cat = r[0]; continue
                    if not r[0]: continue
                    d = dict(listino=lst, categoria=cat or "", codice=r[0], descrizione=r[1], fascia=r[2],
                             prezzo_gold=money(r[-2]), prezzo_eu=money(r[-1]), ppm_gold=None, ppm_eu=None)
                    if lst == "CLASSOUND":
                        d["ppm_gold"], d["ppm_eu"] = money(r[3]), money(r[4])
                    if d["prezzo_gold"] is None or d["prezzo_eu"] is None:
                        print("  riga saltata (prezzo non leggibile):", r, file=sys.stderr); continue
                    out.append(d)
    return out

def periodo(c):
    m = re.search(r"-(1m|1y|5y)$", c); return m.group(1) if m else ""
def base(c): return re.sub(r"-(1m|1y|5y)$", "", c)
def fascia(u):
    m = re.match(r"^(\d+)\s*-\s*(\d+)$", u or "")
    if m: return int(m.group(1)), int(m.group(2))
    m = re.match(r"^(\d+)\+$", u or "")
    if m: return int(m.group(1)), None
    return None, None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("versione", help='nome della versione, es. "Dicembre 2026"')
    ap.add_argument("pdf", nargs="+")
    ap.add_argument("-o", "--out", default="listino.json")
    a = ap.parse_args()
    src = []
    for p in a.pdf:
        t = tipo_da_nome(p); r = leggi(p, t); print(f"{p}: {t}, {len(r)} righe"); src += r
    # le descrizioni spezzate a fine pagina: si usa la più lunga dello stesso articolo
    best = {}
    for o in src:
        k = (o["listino"], base(o["codice"]))
        if len(o["descrizione"]) > len(best.get(k, "")): best[k] = o["descrizione"]
    campi = ["listino","categoria","codice","descrizione","fascia","q_min","q_max","periodo","prezzo_gold","prezzo_eu","ppm_gold","ppm_eu"]
    righe = []
    for o in src:
        qmin, qmax = fascia(o["fascia"])
        righe.append([o["listino"], o["categoria"], o["codice"], best[(o["listino"], base(o["codice"]))], o["fascia"],
                      qmin, qmax, periodo(o["codice"]), o["prezzo_gold"], o["prezzo_eu"], o["ppm_gold"], o["ppm_eu"]])
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"versione": a.versione, "campi": campi, "righe": righe}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Scritto {a.out}: {len(righe)} righe. Importalo dalla scheda Listini.")

if __name__ == "__main__":
    main()
