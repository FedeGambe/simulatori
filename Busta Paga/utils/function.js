import { readFileSync } from "node:fs";
import { join } from "node:path";

function leggiConfig(nomeFile) {
    return JSON.parse(readFileSync(join(import.meta.dirname, "../config", nomeFile), "utf-8"));
}

const scaglioniIrpef = leggiConfig("scaglioni-irpef.json");
const detrazioniIrpef = leggiConfig("detrazioni-irpef.json");
const cuneoFiscale = leggiConfig("cuneo-fiscale.json");

export function arrotonda(valore) {
    return Math.round(valore * 100) / 100;
}

function trovaFascia(reddito, fasce) {
    return fasce.find((fascia) => reddito > fascia.da && reddito <= fascia.a);
}

// art. 13 TUIR: base + variabile × (a − reddito) / (a − da)
// es. 1910 + 1190 × (28000 − reddito) / 13000
function importoFascia(reddito, fascia) {
    return fascia.base + fascia.variabile * (fascia.a - reddito) / (fascia.a - fascia.da);
}

export function calcolaIrpefLorda(reddito, scaglioni = scaglioniIrpef.scaglioni) {
    let imposta = 0;
    for (const scaglione of scaglioni) {
        if (reddito <= scaglione.da) {
            break;
        }
        const limite = scaglione.a ?? Infinity;
        const parte = Math.min(reddito, limite) - scaglione.da;
        imposta += parte * scaglione.aliquota;
    }
    return imposta;
}

// giorni: giorni lavorati nell'anno, la detrazione si riduce in proporzione
// tempoDeterminato: cambia il minimo garantito per redditi fino a 15.000
export function calcolaDetrazioni(reddito, { giorni = 365, tempoDeterminato = false } = {}, detrazioni = detrazioniIrpef) {
    const fascia = trovaFascia(reddito, detrazioni.fasce);
    if (!fascia) {
        return 0;
    }

    let importo = importoFascia(reddito, fascia);

    const maggiorazione = detrazioni.maggiorazione;
    if (reddito > maggiorazione.da && reddito <= maggiorazione.a) {
        importo += maggiorazione.importo;
    }

    importo = importo * giorni / 365;

    if (fascia === detrazioni.fasce[0]) {
        const minimo = tempoDeterminato ? detrazioni.minimo.determinato : detrazioni.minimo.indeterminato;
        importo = Math.max(importo, minimo);
    }

    return importo;
}

// cuneo fiscale, redditi fino a 20.000: somma non tassata pagata in busta paga
export function calcolaSommaEsente(reddito, cuneo = cuneoFiscale) {
    const fascia = trovaFascia(reddito, cuneo.sommaEsente.fasce);
    return fascia ? reddito * fascia.percentuale : 0;
}

// cuneo fiscale, redditi tra 20.000 e 40.000: detrazione aggiuntiva fino a 1.000
export function calcolaUlterioreDetrazione(reddito, cuneo = cuneoFiscale) {
    const fascia = trovaFascia(reddito, cuneo.ulterioreDetrazione.fasce);
    return fascia ? importoFascia(reddito, fascia) : 0;
}

export function calcolaIrpef(reddito, opzioni = {}) {
    const lorda = calcolaIrpefLorda(reddito);
    const detrazioni = calcolaDetrazioni(reddito, opzioni);
    const ulterioreDetrazione = calcolaUlterioreDetrazione(reddito);
    // le detrazioni non possono portare l'imposta sotto zero
    const netta = Math.max(0, lorda - detrazioni - ulterioreDetrazione);

    return {
        reddito,
        lorda: arrotonda(lorda),
        detrazioni: arrotonda(detrazioni),
        ulterioreDetrazione: arrotonda(ulterioreDetrazione),
        netta: arrotonda(netta),
        sommaEsente: arrotonda(calcolaSommaEsente(reddito)),
        aliquotaMedia: reddito > 0 ? arrotonda((netta / reddito) * 100) : 0,
    };
}

// come in Excel: dall'imponibile del mese si ricava il reddito annuo,
// si calcola l'IRPEF annua e la si divide sulle mensilità
export function calcolaIrpefMensile(imponibileMensile, mensilita = 14, opzioni = {}) {
    const annua = calcolaIrpef(imponibileMensile * mensilita, opzioni);
    return {
        ...annua,
        nettaMensile: arrotonda(annua.netta / mensilita),
        sommaEsenteMensile: arrotonda(annua.sommaEsente / mensilita),
    };
}

// prove: si eseguono solo lanciando direttamente `node utils/function.js`
if (import.meta.main) {
    console.log(calcolaIrpefLorda(23947.31)); // 4600

    console.log(arrotonda(calcolaDetrazioni(23947.31))); // 1955
    console.log(arrotonda(calcolaDetrazioni(20000))); // 2642.31
    console.log(arrotonda(calcolaDetrazioni(30000))); // 1801.36
    console.log(arrotonda(calcolaDetrazioni(60000))); // 0
    console.log(arrotonda(calcolaDetrazioni(5000, { giorni: 100 }))); // 690

    console.table([23947.31].map((reddito) => calcolaIrpef(reddito)));
    console.log(calcolaIrpefMensile(1710.52));
}
