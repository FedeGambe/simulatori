import { arrotonda, calcolaIrpef } from "./irpef_function.js";
import { calcolaImponibileFiscale } from "./contributi_function.js";
import { calcolaAddizionali } from "./addizionali_function.js";

// dalla RAL al netto annuo e mensile.
// opzioni: mensilita (12/13/14), fondo, apprendista, massimale, altreVoci, deduzioni (importi mensili),
//   giorni, tempoDeterminato, familiari ({ coniuge, figli21, ... }), comune / regione (addizionali)
// semplificazioni: addizionali = totale annuo / mensilità (non le rate reali), TFR e assegno unico esclusi
export function calcolaNetto(ral, { mensilita = 14, ...opzioni } = {}) {
    const fiscale = calcolaImponibileFiscale(ral / mensilita, opzioni);
    const imponibileAnnuo = fiscale.imponibileFiscale * mensilita;

    const irpef = calcolaIrpef(imponibileAnnuo, opzioni);
    const addizionali = calcolaAddizionali(imponibileAnnuo, { ...opzioni, irpefNetta: irpef.netta });

    // L. 207/2024: la somma esente si somma al netto, non è tassata
    const contributi = fiscale.contributi.totale * mensilita;
    const trattenute = fiscale.trattenuteNette * mensilita;
    const nettoAnnuo = ral - contributi - trattenute - irpef.netta - addizionali.regionale - addizionali.comunale + irpef.sommaEsente;

    return {
        ral,
        mensilita,
        contributi: arrotonda(contributi),
        imponibileFiscale: arrotonda(imponibileAnnuo),
        irpef,
        addizionali,
        trattenute: arrotonda(trattenute),
        nettoAnnuo: arrotonda(nettoAnnuo),
        nettoMensile: arrotonda(nettoAnnuo / mensilita),
    };
}

if (import.meta.main) {
    const base = { comune: "F257", fondo: "fsba" };
    const r = calcolaNetto(30000, base);
    console.log(r.nettoAnnuo, r.nettoMensile, r.irpef.sommaEsente, r.irpef.ulterioreDetrazione);
    // 12 mensilità: stesso netto annuo (±1€ per arrotondamento INPS), mensile più alto
    console.assert(Math.abs(calcolaNetto(30000, { ...base, mensilita: 12 }).nettoAnnuo - r.nettoAnnuo) < 1, "annuo indipendente da mensilità");
    // coniuge a carico: netto sale
    console.assert(calcolaNetto(30000, { ...base, familiari: { coniuge: true } }).nettoAnnuo > r.nettoAnnuo, "coniuge");
    // cuneo: 18.000 lordi, somma esente 4,8% dell'imponibile
    console.log(calcolaNetto(18000, base).irpef.sommaEsente);
    // figli21: 1 figlio a 30.000 → 950 × 65/95 ≈ 650
    console.log(calcolaNetto(30000, { ...base, familiari: { figli21: 1 } }).irpef.detrazioniFamiliari);
}
