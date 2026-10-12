import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcolaNetto } from "../../Busta Paga/utils/netto_function.js";
import { calcolaDeduzioni } from "../../Busta Paga/utils/contributi_function.js";

const config = JSON.parse(readFileSync(join(import.meta.dirname, "../config/fondo.json"), "utf-8"));

// quanta IRPEF (e addizionali) fa risparmiare la deduzione: differenza di netto con e senza fondo,
// più la somma dedotta (che nel netto "con fondo" è uscita dalla busta).
// Il calcolo è in euro di oggi: le soglie fiscali si assumono indicizzate all'inflazione.
function risparmioIrpef(ralReale, dedottoReale, comune) {
    const base = { mensilita: 14, comune };
    const senza = calcolaNetto(ralReale, base).nettoAnnuo;
    const con = calcolaNetto(ralReale, { ...base, deduzioni: { previdenzaComplementare: dedottoReale / 14 } }).nettoAnnuo;
    return Math.max(0, con - senza + dedottoReale);
}

// anno per anno fino alla pensione.
// lavoratore / datore: { valore, unita }, con unita "p" (% della RAL) o "e" (euro all'anno)
// rendimento, costi, titoliStato, inflazione, crescita: in %. Importi nominali; "reale" = euro di oggi.
// semplificazioni: versamenti spalmati nell'anno (rendimento a metà anno), limite di deduzione fisso (come in legge),
//   niente recupero del plafond non dedotto nei primi 5 anni, TFR non confrontato con quello lasciato in azienda
export function simulaFondo({ eta, pensione, ral, comune, lavoratore, datore, tfr = true, montante0 = 0, anniIscritto = 0, rendimento, costi, titoliStato, inflazione, crescita }, cfg = config) {
    const anni = pensione - eta;
    const importo = (v, ralAnno) => (v.unita === "p" ? ralAnno * v.valore / 100 : v.valore);

    const imposta = cfg.imposta.rendimenti - (cfg.imposta.rendimenti - cfg.imposta.rendimentiTitoliStato) * titoliStato / 100;
    const netto = (rendimento - costi) / 100;
    const rendimentoNetto = netto > 0 ? netto * (1 - imposta) : netto;

    const p = cfg.prestazione;
    const aliquotaPrestazione = (anniIscrizione) => Math.max(p.minima, p.aliquota - p.riduzionePerAnno * Math.max(0, anniIscrizione - p.dopoAnni));

    // confronto: ogni anno i soldi o vanno nel fondo (e il fisco ne restituisce una parte) oppure restano in tasca dopo l'IRPEF,
    // dove si tengono in contanti o si investono fuori dal fondo (stesso rendimento e costi, 26% sul guadagno a fine periodo).
    // Due scenari: solo i tuoi versamenti, oppure anche il contributo del datore (che avresti solo aderendo al fondo).
    // Il TFR non c'è: è tuo sia nel fondo sia in azienda. Il montante già accumulato non conta: è uguale in entrambi.
    const tassaLibera = cfg.imposta.rendimentiLiberi - (cfg.imposta.rendimentiLiberi - cfg.imposta.rendimentiTitoliStato) * titoliStato / 100;
    const crescitaLibera = netto;
    const scenario = () => ({ fondo: 0, base: 0, libero: 0, contanti: 0, punti: [{ eta, fondo: 0, libero: 0, contanti: 0 }] });
    const avanza = (sc, t, versamento, baseAggiunta, contante) => {
        sc.fondo = sc.fondo * (1 + rendimentoNetto) + versamento * (1 + rendimentoNetto / 2);
        sc.base += baseAggiunta;
        sc.libero = sc.libero * (1 + crescitaLibera) + contante * (1 + crescitaLibera / 2);
        sc.contanti += contante;
        sc.punti.push({
            eta: eta + t + 1,
            fondo: sc.fondo - aliquotaPrestazione(anniIscritto + t + 1) * sc.base,
            libero: sc.libero - tassaLibera * Math.max(0, sc.libero - sc.contanti),
            contanti: sc.contanti,
        });
    };
    const soloTuo = scenario(), completo = scenario();

    const punti = [{ eta, versati: montante0, rendimenti: 0, montante: montante0, risparmio: 0 }];
    const righe = [];
    let montante = montante0, versati = montante0, risparmio = 0;
    const somma = { lavoratore: 0, datore: 0, tfr: 0, dedotto: 0 };

    for (let t = 0; t < anni; t++) {
        const inflazioneT = (1 + inflazione / 100) ** t;
        const ralT = ral * (1 + crescita / 100) ** t;
        const w = importo(lavoratore, ralT);
        const d = importo(datore, ralT);
        const f = tfr ? ralT * cfg.tfr.quotaAnnua : 0;
        // il limite di deduzione vale per lavoratore e datore insieme, il TFR non si deduce
        const dedotto = calcolaDeduzioni({ previdenzaComplementare: w, previdenzaComplementareDitta: d, mensilita: 1 });
        const risparmioT = risparmioIrpef(ralT / inflazioneT, dedotto / inflazioneT, comune) * inflazioneT;
        // senza il datore il limite di deduzione è tutto per il lavoratore
        const dedottoSolo = d > 0 ? calcolaDeduzioni({ previdenzaComplementare: w, previdenzaComplementareDitta: 0, mensilita: 1 }) : dedotto;
        const risparmioSolo = d > 0 ? risparmioIrpef(ralT / inflazioneT, dedottoSolo / inflazioneT, comune) * inflazioneT : risparmioT;
        avanza(soloTuo, t, w, dedottoSolo, w - risparmioSolo);
        avanza(completo, t, w + d, dedotto + d, w - risparmioT);

        const versamento = w + d + f;
        const rendimentoT = montante * rendimentoNetto + versamento * rendimentoNetto / 2;
        montante += versamento + rendimentoT;
        versati += versamento;
        risparmio += risparmioT;
        somma.lavoratore += w; somma.datore += d; somma.tfr += f; somma.dedotto += dedotto;

        righe.push({ eta: eta + t, ral: ralT, lavoratore: w, datore: d, tfr: f, dedotto, risparmio: risparmioT, risparmioSolo, rendimento: rendimentoT, montante });
        punti.push({ eta: eta + t + 1, versati, rendimenti: montante - versati, montante, risparmio });
    }

    // la prestazione si tassa sui contributi dedotti, del datore e sul TFR: i rendimenti sono già tassati ogni anno
    const aliquota = aliquotaPrestazione(anniIscritto + anni);
    const baseImponibile = montante0 + somma.dedotto + somma.datore + somma.tfr;
    const impostaFinale = baseImponibile * aliquota;
    const deflatore = (1 + inflazione / 100) ** anni;

    return {
        anni, righe, punti,
        aliquotaRendimenti: imposta,
        aliquotaPrestazione: aliquota,
        aliquotaLibera: tassaLibera,
        confronto: { soloTuo: soloTuo.punti, completo: completo.punti },
        versamenti: { ...somma, totale: somma.lavoratore + somma.datore + somma.tfr },
        risparmioIrpef: risparmio,
        // quanto costa davvero ogni euro versato dal lavoratore, dopo il risparmio fiscale
        costoReale: somma.lavoratore > 0 ? Math.max(0, (somma.lavoratore - risparmio) / somma.lavoratore) : 1,
        montante, rendimenti: montante - versati, imposta: impostaFinale, nettoFinale: montante - impostaFinale,
        montanteReale: montante / deflatore, nettoFinaleReale: (montante - impostaFinale) / deflatore,
    };
}

// prove: si eseguono solo lanciando direttamente `node utils/fondo_function.js`
if (import.meta.main) {
    const base = {
        eta: 35, pensione: 67, ral: 30000, comune: "F257", lavoratore: { valore: 2, unita: "p" }, datore: { valore: 2, unita: "p" },
        rendimento: 4, costi: 1, titoliStato: 30, inflazione: 2, crescita: 2,
    };
    const r = simulaFondo(base);
    console.log(Math.round(r.montante), Math.round(r.nettoFinale), Math.round(r.nettoFinaleReale), Math.round(r.risparmioIrpef), r.aliquotaPrestazione.toFixed(3), r.costoReale.toFixed(2));
    console.assert(r.anni === 32 && r.punti.length === 33, "un punto per anno");
    console.assert(r.montante > r.versamenti.totale, "il fondo cresce più dei versamenti");
    console.assert(r.risparmioIrpef > 0 && r.costoReale < 1 && r.costoReale > 0.5, "la deduzione fa risparmiare");
    console.assert(Math.abs(r.aliquotaPrestazione - 0.099) < 1e-9, "32 anni: 15% - 17 x 0,30 punti = 9,9%");
    // rendimento nullo: senza costi né rendimento il montante è la somma dei versamenti
    const piatto = simulaFondo({ ...base, rendimento: 0, costi: 0 });
    console.assert(Math.abs(piatto.montante - piatto.versamenti.totale) < 0.01, "rendimento zero");
    // oltre il limite di 5.164,57 la deduzione non cresce, il risparmio sì ma meno che proporzionale
    const alto = simulaFondo({ ...base, ral: 60000, lavoratore: { valore: 10, unita: "p" } });
    console.assert(alto.versamenti.dedotto / 32 <= 5164.57 + 0.01, "limite di deduzione");
    // confronto: con la deduzione il fondo batte lo stesso importo investito fuori; senza rendimento e senza tasse è un pareggio con i contanti
    const f = r.confronto.soloTuo.at(-1), g = r.confronto.completo.at(-1);
    console.assert(f.fondo > f.libero && f.libero > f.contanti * 0.9 && g.fondo > f.fondo, "il fondo batte il libero, e col datore ancora di più");
    const a = simulaFondo({ ...base, rendimento: 0, costi: 0, datore: { valore: 0, unita: "p" }, tfr: false }).confronto.soloTuo.at(-1);
    console.assert(Math.abs(a.libero - a.contanti) < 0.01 && a.fondo > a.contanti, "senza rendimento il libero è uguale ai contanti, il fondo ha la deduzione");
    // senza versamenti del lavoratore non c'è risparmio IRPEF
    console.assert(simulaFondo({ ...base, lavoratore: { valore: 0, unita: "p" } }).risparmioIrpef === 0, "niente versamento, niente risparmio");
}
