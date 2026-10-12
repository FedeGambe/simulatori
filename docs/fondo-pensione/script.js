// GENERATO da "Fondo Pensione"/scripts/build-dashboard.js: non modificare a mano.
(function () {
"use strict";
var Busta = window.Busta, calcolaNetto = Busta.calcolaNetto, calcolaDeduzioni = Busta.calcolaDeduzioni;
const config = {"anno":2026,"tfr":{"quotaAnnua":0.0691,"fonte":"Art. 2120 c.c.: retribuzione / 13,5, meno lo 0,50% di contributo INPS"},"imposta":{"rendimenti":0.2,"rendimentiTitoliStato":0.125,"rendimentiLiberi":0.26,"fonte":"D.Lgs. 252/2005 art. 17: 20% sul risultato netto annuo del fondo, 12,5% sulla parte in titoli di Stato. Investimento libero: 26% sul guadagno, 12,5% sui titoli di Stato"},"prestazione":{"aliquota":0.15,"minima":0.09,"dopoAnni":15,"riduzionePerAnno":0.003,"fonte":"D.Lgs. 252/2005 art. 11 c. 6: 15% ridotto di 0,30 punti per ogni anno oltre il 15°, fino al 9%"}};

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
function simulaFondo({ eta, pensione, ral, comune, lavoratore, datore, tfr = true, montante0 = 0, anniIscritto = 0, rendimento, costi, titoliStato, inflazione, crescita }, cfg = config) {
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


window.Fondo = { simulaFondo: simulaFondo };
})();
