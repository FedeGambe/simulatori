import { leggiConfig, arrotonda, calcolaIrpefLorda } from "./irpef_function.js";

const regionali = leggiConfig("addizionali-regionali.json");
const comunali = leggiConfig("addizionali-comunali.json");

// un numero diventa un'aliquota unica: 0.008 -> { fasce: [{ da: 0, aliquota: 0.008 }] }
function normalizza(regole) {
    return typeof regole === "number" ? { fasce: [{ da: 0, aliquota: regole }] } : regole;
}

// regole comuni a regionale e comunale:
// - esenzione: fino a quel reddito non si paga, oltre si paga su tutto
// - aliquotaRidotta: fino a quel reddito un'aliquota unica su tutto, oltre le fasce a scaglioni
// - detrazioni: importo fisso tra da e a; con rampa cresce da 0 a importo tra da e da + rampa
export function calcolaAddizionale(reddito, regole) {
    const { fasce, esenzione, aliquotaRidotta, detrazioni = [] } = normalizza(regole);
    if (esenzione && reddito <= esenzione) {
        return 0;
    }

    const imposta = aliquotaRidotta && reddito <= aliquotaRidotta.fino
        ? reddito * aliquotaRidotta.aliquota
        : calcolaIrpefLorda(reddito, fasce);

    const detrazione = detrazioni
        .filter((d) => reddito > d.da && reddito <= (d.a ?? Infinity))
        .reduce((somma, d) => somma + (d.rampa ? d.importo * Math.min(1, (reddito - d.da) / d.rampa) : d.importo), 0);

    return Math.max(0, imposta - detrazione);
}

// per la ricerca nella dashboard: "mode" -> Modena, Modigliana, ...
export function cercaComuni(testo, limite = 20) {
    const cerca = testo.trim().toUpperCase();
    if (!cerca) {
        return [];
    }
    return Object.entries(comunali.comuni)
        .filter(([, comune]) => comune.nome.startsWith(cerca))
        .slice(0, limite)
        .map(([codice, comune]) => ({ codice, nome: comune.nome, pr: comune.pr }));
}

export function trovaComune(codice) {
    const comune = comunali.comuni[codice];
    if (!comune) {
        throw new Error(`Comune sconosciuto: ${codice}`);
    }
    return { codice, ...comune, regione: regionali.province[comune.pr] };
}

export function elencoRegioni() {
    return Object.keys(regionali.regioni);
}

// reddito: imponibile IRPEF annuo
// comune: codice catastale (es. "F257" Modena), da cui si ricava anche la regione
// regione / comunale: per sovrascrivere i default, con il nome della regione,
//   un'aliquota unica (0.0123) o regole complete ({ fasce, esenzione, ... })
// irpefNetta: se è 0 le addizionali non sono dovute
export function calcolaAddizionali(reddito, { comune, regione, comunale, irpefNetta } = {}) {
    const datiComune = comune ? trovaComune(comune) : null;

    const regioneManuale = regione !== undefined && typeof regione !== "string";
    const nomeRegione = typeof regione === "string" ? regione : datiComune?.regione;
    const regoleRegione = regioneManuale ? regione : regionali.regioni[nomeRegione];
    const regoleComune = comunale ?? (datiComune?.fasce.length ? datiComune : 0);

    if (!regoleRegione) {
        throw new Error("Serve un comune, una regione o un'aliquota regionale");
    }

    const dovute = irpefNetta === undefined || irpefNetta > 0;
    const importoRegionale = dovute ? calcolaAddizionale(reddito, regoleRegione) : 0;
    const importoComunale = dovute ? calcolaAddizionale(reddito, regoleComune) : 0;

    // in busta: regionale e saldo comunale in 11 rate, acconto comunale (30%) in 9 rate
    const { rate } = regionali;
    const acconto = importoComunale * rate.comunaleAcconto.percentuale;

    return {
        regione: regioneManuale ? "manuale" : nomeRegione,
        comune: comunale !== undefined ? "manuale" : datiComune?.nome ?? null,
        daVerificare: comunale === undefined ? datiComune?.daVerificare ?? [] : [],
        regionale: arrotonda(importoRegionale),
        comunale: arrotonda(importoComunale),
        rataRegionale: arrotonda(importoRegionale / rate.regionale),
        rataComunaleSaldo: arrotonda((importoComunale - acconto) / rate.comunaleSaldo),
        rataComunaleAcconto: arrotonda(acconto / rate.comunaleAcconto.rate),
    };
}

// prove: si eseguono solo lanciando direttamente `node utils/addizionali_function.js`
if (import.meta.main) {
    console.log(cercaComuni("modena"));
    // Modena: regionale ER a scaglioni, comunale 0,8% con esenzione 15.000
    console.log(calcolaAddizionali(23947.31, { comune: "F257" })); // regionale 372.18, comunale 191.58
    console.log(calcolaAddizionali(14000, { comune: "F257" }).comunale); // 0 (esente)
    console.log(calcolaAddizionali(25000, { regione: "LAZIO" }).regionale); // 432.5 (1,73% su tutto)
    console.log(calcolaAddizionali(29000, { regione: "LAZIO" }).regionale); // 725.7 a scaglioni - 60 di detrazione = 665.7
    console.log(calcolaAddizionali(25000, { regione: "TRENTO" }).regionale); // 0
    console.log(calcolaAddizionali(30000, { comune: "F257", comunale: 0.005, regione: 0.0123 }));
    console.log(calcolaAddizionali(10000, { comune: "F257", irpefNetta: 0 }).regionale); // 0
}
