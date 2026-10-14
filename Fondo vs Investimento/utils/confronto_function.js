import { readFileSync } from "node:fs";
import { join } from "node:path";
import { simulaFondo } from "../../Fondo Pensione/utils/fondo_function.js";

const config = JSON.parse(readFileSync(join(import.meta.dirname, "../config/confronto.json"), "utf-8"));
const fondoCfg = JSON.parse(readFileSync(join(import.meta.dirname, "../../Fondo Pensione/config/fondo.json"), "utf-8"));

// Stessi soldi messi da parte, due strade: versare nel fondo pensione (deduzione IRPEF, contributo del datore, tassa 20%/12,5% sui rendimenti
// ogni anno, 15%→9% sui contributi alla fine) oppure investire dopo l'IRPEF fuori dal fondo (ETF o titoli: 26%, o 12,5% sui titoli di Stato,
// sul solo guadagno a fine periodo, più il bollo annuo sul conto titoli).
// p: { eta, pensione, ral, comune, versaFondo, versaLibero (€ all'anno, costanti), datore (% della RAL), rendFondo, costiFondo, statoFondo,
//      rendLibero, costiLibero, statoLibero, inflazione, crescita } (rendimenti, costi, stato, inflazione, crescita in %)
// semplificazioni: importi costanti in euro; il contributo del datore c'è solo se versi nel fondo almeno minimoDatore% della RAL (RAL di oggi); niente TFR (è tuo comunque).
// extra: array facoltativo, un importo per anno in più (l'IRPEF recuperata nel fondo, reinvestita fuori): entra nel valore e nella base della tassa, non in versati
export function simulaLibero({ eta, anni, versamento, rendimento, costi, titoliStato, extra = [] }, cfg = config, fiscale = fondoCfg) {
    const g = (rendimento - costi) / 100 - cfg.bolloTitoli;
    const tassa = fiscale.imposta.rendimentiLiberi - (fiscale.imposta.rendimentiLiberi - fiscale.imposta.rendimentiTitoliStato) * titoliStato / 100;
    let valore = 0, reinvestito = 0;
    const punti = [{ eta, versati: 0, valore: 0, netto: 0 }];
    for (let t = 0; t < anni; t++) {
        const e = extra[t] ?? 0;
        valore = valore * (1 + g) + (versamento + e) * (1 + g / 2);
        reinvestito += e;
        const versati = versamento * (t + 1);
        punti.push({ eta: eta + t + 1, versati, valore, netto: valore - tassa * Math.max(0, valore - versati - reinvestito) });
    }
    return { punti, tassa, netto: punti[anni].netto, versati: versamento * anni };
}

// il datore versa il suo contributo solo se metti nel fondo almeno il minimo (% della RAL, oggi 0,5%: soglia tipica dei fondi di categoria)
export const datoreDi = (p, w, cfg = config) => (w > 0 && w >= p.ral * cfg.minimoDatore / 100 - 1e-9 ? p.datore : 0);

function fondoCon(p, w) {
    return simulaFondo({
        eta: p.eta, pensione: p.pensione, ral: p.ral, comune: p.comune,
        lavoratore: { valore: w, unita: "e" }, datore: { valore: datoreDi(p, w), unita: "p" }, tfr: false,
        rendimento: p.rendFondo, costi: p.costiFondo, titoliStato: p.statoFondo, inflazione: p.inflazione, crescita: p.crescita,
    });
}

// quanto ti esce di tasca il primo anno versando w nel fondo: w meno l'IRPEF recuperata
export function costoFondo(p, w) {
    if (w <= 0) return 0;
    const r = simulaFondo({
        eta: p.eta, pensione: p.eta + 1, ral: p.ral, comune: p.comune, lavoratore: { valore: w, unita: "e" }, datore: { valore: datoreDi(p, w), unita: "p" },
        tfr: false, rendimento: 0, costi: 0, titoliStato: 0, inflazione: 0, crescita: 0,
    });
    return w - r.righe[0].risparmio;
}

const anniDi = (p) => p.pensione - p.eta;
const rimborsi = (f) => (f ? f.righe.map((x) => x.risparmio) : []);
const liberoCon = (p, i, extra) => simulaLibero({ eta: p.eta, anni: anniDi(p), versamento: i, extra, rendimento: p.rendLibero, costi: p.costiLibero, titoliStato: p.statoLibero });

// una combinazione (w nel fondo, i fuori): netto finale, costo di tasca di tutti gli anni e da dove arriva il netto
function esito(p, w, i, deflatore) {
    const f = w > 0 ? fondoCon(p, w) : null, l = i > 0 || f ? liberoCon(p, i, rimborsi(f)) : null;
    const versato = (f ? f.versamenti.lavoratore : 0) + (l ? l.versati : 0), irpef = f ? f.risparmioIrpef : 0, datore = f ? f.versamenti.datore : 0;
    const lordo = (f ? f.montante : 0) + (l ? l.punti.at(-1).valore : 0);
    const imposta = (f ? f.imposta : 0) + (l ? l.punti.at(-1).valore - l.netto : 0);
    const netto = lordo - imposta, costo = versato - irpef;
    // stima dell'IRPEF non recuperata: versamenti oltre il limite di deduzione, all'aliquota media recuperata sulla parte dedotta
    const irpefPersa = f ? f.righe.reduce((s, x) => s + (x.dedotto > 0 ? Math.max(0, x.lavoratore - x.dedotto) * x.risparmio / x.dedotto : 0), 0) : 0;
    return { w, i, netto, irpefPersa, nettoReale: netto / deflatore, costo, perCento: costo > 0 ? netto / costo * 100 : 0, versato, irpef, datore, rendimenti: lordo - versato - datore - irpef, imposta };
}

export function simulaConfronto(p, cfg = config, fiscale = fondoCfg) {
    const anni = anniDi(p);
    const deflatore = (1 + p.inflazione / 100) ** anni;
    const pr = fiscale.prestazione;
    const aliquota = (n) => Math.max(pr.minima, pr.aliquota - pr.riduzionePerAnno * Math.max(0, n - pr.dopoAnni));

    const f = fondoCon(p, p.versaFondo);
    const l = simulaLibero({ eta: p.eta, anni, versamento: p.versaLibero, extra: rimborsi(f), rendimento: p.rendLibero, costi: p.costiLibero, titoliStato: p.statoLibero }, cfg, fiscale);

    // anno per anno: valore del fondo se uscissi quell'anno (tassa sulla prestazione compresa), dell'investimento libero, costo cumulato
    let base = 0, costo = 0;
    const punti = [{ eta: p.eta, fondo: 0, libero: 0, totale: 0, versati: 0, costo: 0 }];
    f.righe.forEach((x, t) => {
        base += x.dedotto + x.datore;
        costo += x.lavoratore - x.risparmio + p.versaLibero;
        const fondo = f.punti[t + 1].montante - aliquota(t + 1) * base;
        const libero = l.punti[t + 1].netto;
        punti.push({ eta: x.eta + 1, fondo, libero, totale: fondo + libero, versati: f.punti[t + 1].versati + l.punti[t + 1].versati, costo });
    });

    const netto = punti[anni].totale;
    const costoAnno1 = f.righe[0].lavoratore - f.righe[0].risparmio + p.versaLibero;
    const out = {
        anni, deflatore, punti, fondo: f, libero: l, tuo: esito(p, p.versaFondo, p.versaLibero, deflatore),
        parteFondo: esito(p, p.versaFondo, 0, deflatore), parteLibero: esito(p, 0, p.versaLibero, deflatore), // le due metà della tua suddivisione, ognuna col suo costo
        netto, nettoReale: netto / deflatore, costo, costoAnno1,
        guadagno: netto - costo, perCento: costo > 0 ? netto / costo * 100 : 0,
        versatoFondo: f.versamenti.lavoratore, versatoDatore: f.versamenti.datore, versatoLibero: l.versati,
        risparmioIrpef: f.risparmioIrpef, impostaPrestazione: f.imposta, aliquotaPrestazione: f.aliquotaPrestazione, aliquotaLibera: l.tassa,
    };
    const tot = p.versaFondo + p.versaLibero;
    if (tot > 0) {
        // le due strade pure, con gli stessi soldi messi da parte (il costo di tasca è diverso: il fondo recupera IRPEF)
        out.tuttoFondo = serieIntera(p, tot, 0, deflatore, aliquota);
        out.tuttoLibero = serieIntera(p, 0, tot, deflatore, aliquota);
        // rendimento lordo dell'investimento libero che lo porta alla pari con il fondo (a parità di netto ogni 100 € di costo)
        const mira = out.tuttoFondo.perCento;
        const ric = (r) => esito({ ...p, rendLibero: r }, 0, tot, deflatore).perCento;
        if (ric(-10) > mira || ric(40) < mira) out.pareggio = null;
        else {
            let a = -10, b = 40;
            for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (ric(m) < mira) a = m; else b = m; }
            out.pareggio = (a + b) / 2;
        }
    }
    return out;
}

// una strada sola: netto finale, costo e valore anno per anno
function serieIntera(p, w, i, deflatore, aliquota) {
    const r = esito(p, w, i, deflatore);
    const f = w > 0 ? fondoCon(p, w) : null, l = i > 0 || f ? liberoCon(p, i, rimborsi(f)) : null;
    let base = 0;
    r.punti = (f || l).punti.map((x, k) => {
        if (f && k > 0) base += f.righe[k - 1].dedotto + f.righe[k - 1].datore;
        return { eta: x.eta, netto: (f ? (k === 0 ? 0 : f.punti[k].montante - aliquota(k) * base) : 0) + (l ? l.punti[k].netto : 0) };
    });
    return r;
}

// netto finale dividendo lo stesso importo tra fondo e libero: quota = parte che va al fondo (0..1)
export function curvaBilanciamento(p, passi = 10) {
    const deflatore = (1 + p.inflazione / 100) ** anniDi(p), tot = p.versaFondo + p.versaLibero, out = [];
    for (let k = 0; k <= passi; k++) {
        const quota = k / passi;
        const r = esito(p, tot * quota, tot * (1 - quota), deflatore);
        out.push({ quota, w: r.w, i: r.i, netto: r.netto, nettoReale: r.nettoReale, costo: r.costo, perCento: r.perCento, irpef: r.irpef });
    }
    return out;
}

// prove: si eseguono solo lanciando direttamente `node utils/confronto_function.js`
if (import.meta.main) {
    const base = {
        eta: 35, pensione: 67, ral: 30000, comune: "F257", versaFondo: 2000, datore: 2, versaLibero: 0,
        rendFondo: 4, costiFondo: 1, statoFondo: 30, rendLibero: 4, costiLibero: 0.25, statoLibero: 30, inflazione: 2, crescita: 2,
    };
    const t0 = Date.now();
    const r = simulaConfronto(base);
    console.log(Math.round(r.netto), Math.round(r.costo), r.perCento.toFixed(0), "pareggio", r.pareggio?.toFixed(2), r.tuttoFondo.perCento.toFixed(0), r.tuttoLibero.perCento.toFixed(0), Date.now() - t0, "ms");
    console.assert(r.anni === 32 && r.punti.length === 33, "un punto per anno");
    console.assert(r.costo < r.versatoFondo, "il costo è sotto il versato: IRPEF recuperata");
    // a pari rendimento il fondo vince grazie a deduzione e datore
    console.assert(r.tuttoFondo.perCento > r.tuttoLibero.perCento, "a pari rendimento il fondo batte il libero");
    console.assert(r.pareggio > base.rendFondo, "il libero deve rendere di più per pareggiare");
    // libero puro
    const solo = simulaConfronto({ ...base, versaFondo: 0, versaLibero: 1500 });
    console.assert(Math.abs(solo.netto - solo.tuttoLibero.netto) < 0.01 && solo.risparmioIrpef === 0, "libero puro");
    // il datore non versa se nel fondo metti meno dello 0,5% della RAL (150 € l'anno su 30.000 €)
    console.assert(datoreDi(base, 149) === 0 && datoreDi(base, 150) === 2 && datoreDi(base, 0) === 0, "minimo per il datore");
    // datore in %: 2% di 30.000 = 600 € il primo anno
    console.assert(Math.abs(r.fondo.righe[0].datore - 600) < 0.01, "datore in percentuale");
    // rendimento zero, niente bollo né costi: l'investimento libero restituisce i contanti
    const piatto = simulaLibero({ eta: 35, anni: 10, versamento: 1000, rendimento: 0, costi: 0, titoliStato: 0 }, { bolloTitoli: 0 });
    console.assert(Math.abs(piatto.netto - 10000) < 1e-9, "rendimento zero");
    // la curva: agli estremi coincide con le due strade pure e il costo resta uguale
    const c = curvaBilanciamento(base, 4);
    console.assert(c.length === 5 && Math.abs(c[0].netto - r.tuttoLibero.netto) < 0.01 && Math.abs(c[4].netto - r.tuttoFondo.netto) < 0.5, "estremi della curva");
    // la serie anno per anno finisce sul netto finale
    console.assert(Math.abs(r.tuo.netto - r.netto) < 0.01 && Math.abs(r.tuo.costo - r.costo) < 0.01, "scomposizione = totale");
    console.assert(Math.abs(r.tuttoFondo.punti[anniDi(base)].netto - r.tuttoFondo.netto) < 0.01, "serie = netto finale");
}
