import { arrotonda, calcolaIrpef, leggiConfig } from "./irpef_function.js";
import { calcolaImponibileFiscale } from "./contributi_function.js";
import { calcolaAddizionali } from "./addizionali_function.js";

const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const rateAddizionali = leggiConfig("addizionali-regionali.json").rate;

// divide un totale in n quote da centesimi: l'ultima assorbe l'arrotondamento
function ripartisci(totale, n) {
    const quota = arrotonda(totale / n);
    return Array.from({ length: n }, (_, i) => (i < n - 1 ? quota : arrotonda(totale - quota * (n - 1))));
}

// rate su 12 mesi: `rate` quote a partire dal mese `dal` (0 = gennaio), 0 negli altri
function rateDal(totale, rate, dal) {
    const quote = ripartisci(totale, rate);
    return Array.from({ length: 12 }, (_, i) => (i >= dal && i < dal + rate ? quote[i - dal] : 0));
}

// una riga per ogni pagamento: 12 mesi ordinari + 13ª e 14ª.
// - detrazioni (lavoro, L. 207/24, familiari) solo sui 12 mesi ordinari: le aggiuntive pagano l'IRPEF piena
// - addizionali solo sui mesi ordinari: regionale e saldo comunale in 11 rate da gennaio,
//   acconto comunale in 9 rate da marzo
// - il resto (lordo, contributi, cuneo) è diviso in parti uguali
// il totale delle righe coincide con il netto annuo: le differenze finiscono a dicembre
function calcolaMesi({ ral, mensilita, irpef, addizionali, nettoAnnuo }, trattenute) {
    const n = mensilita;
    const lordo = ripartisci(ral, n);
    const tratt = ripartisci(trattenute, n);
    const irpefLorda = ripartisci(irpef.lorda, n);
    const sommaEsente = ripartisci(irpef.sommaEsente, n);

    const detrazioniAnnue = irpef.lorda - irpef.netta;
    const irpefNetta = irpefLorda.map((lorda, i) => arrotonda(i < 12 ? Math.max(0, lorda - detrazioniAnnue / 12) : lorda));
    // diverso da zero (oltre i centesimi) solo se le detrazioni superano l'imposta di un mese
    const conguaglio = arrotonda(irpef.netta - irpefNetta.reduce((somma, x) => somma + x, 0));
    irpefNetta[11] = arrotonda(irpefNetta[11] + conguaglio);

    const acconto = arrotonda(addizionali.comunale * rateAddizionali.comunaleAcconto.percentuale);
    const regionale = rateDal(addizionali.regionale, rateAddizionali.regionale, 0);
    const saldo = rateDal(addizionali.comunale - acconto, rateAddizionali.comunaleSaldo, 0);
    const accontoMesi = rateDal(acconto, rateAddizionali.comunaleAcconto.rate, 2);

    const righe = lordo.map((_, i) => {
        const ordinaria = i < 12;
        return {
            nome: ordinaria ? MESI[i] : `${i + 1}ª mensilità`,
            aggiuntiva: !ordinaria,
            lordo: lordo[i],
            trattenute: tratt[i],
            irpefLorda: irpefLorda[i],
            detrazioni: arrotonda(irpefLorda[i] - irpefNetta[i]),
            regionale: ordinaria ? regionale[i] : 0,
            comunale: ordinaria ? arrotonda(saldo[i] + accontoMesi[i]) : 0,
            sommaEsente: sommaEsente[i],
        };
    });
    righe.forEach((riga, i) => {
        riga.netto = arrotonda(riga.lordo - riga.trattenute - irpefNetta[i] - riga.regionale - riga.comunale + riga.sommaEsente);
    });
    righe[11].netto = arrotonda(righe[11].netto + nettoAnnuo - righe.reduce((somma, riga) => somma + riga.netto, 0));

    return { righe, conguaglio };
}

// dalla RAL al netto annuo e mensile.
// opzioni: mensilita (12/13/14), fondo, apprendista, massimale, altreVoci, deduzioni (importi mensili),
//   giorni, tempoDeterminato, familiari ({ coniuge, figli21, ... }), comune / regione (addizionali)
// semplificazioni: TFR e assegno unico esclusi; `mesi` ripartisce il netto sui singoli pagamenti (stima, il totale annuo è quello esatto)
export function calcolaNetto(ral, { mensilita = 14, ...opzioni } = {}) {
    const fiscale = calcolaImponibileFiscale(ral / mensilita, opzioni);
    const imponibileAnnuo = fiscale.imponibileFiscale * mensilita;

    const irpef = calcolaIrpef(imponibileAnnuo, opzioni);
    const addizionali = calcolaAddizionali(imponibileAnnuo, { ...opzioni, irpefNetta: irpef.netta });

    // L. 207/2024: la somma esente si somma al netto, non è tassata
    const contributi = fiscale.contributi.totale * mensilita;
    // previdenza complementare e assistenza sanitaria del lavoratore escono dalla busta (la quota ditta no)
    const previdenza = (opzioni.deduzioni?.previdenzaComplementare ?? 0) * mensilita;
    const sanita = (opzioni.deduzioni?.assistenzaSanitaria ?? 0) * mensilita;
    // ogni voce inserita esce dalla busta, anche quella che abbassa l'imponibile IRPEF
    const trattenute = fiscale.altreVoci.reduce((somma, voce) => somma + voce.importo, 0) * mensilita;
    const nettoAnnuo = ral - contributi - previdenza - sanita - trattenute - irpef.netta - addizionali.regionale - addizionali.comunale + irpef.sommaEsente;

    const risultato = {
        ral,
        mensilita,
        contributi: arrotonda(contributi),
        fondo: { importo: arrotonda(fiscale.contributi.fondo * mensilita), aliquota: fiscale.contributi.aliquotaFondo },
        altreVoci: fiscale.altreVoci.map((voce) => ({ ...voce, importo: arrotonda(voce.importo * mensilita) })),
        imponibileFiscale: arrotonda(imponibileAnnuo),
        irpef,
        addizionali,
        versamenti: { previdenza: arrotonda(previdenza), sanita: arrotonda(sanita) },
        trattenute: arrotonda(trattenute),
        nettoAnnuo: arrotonda(nettoAnnuo),
        nettoMensile: arrotonda(nettoAnnuo / mensilita),
    };
    risultato.mesi = calcolaMesi(risultato, risultato.contributi + risultato.versamenti.previdenza + risultato.versamenti.sanita + risultato.trattenute);
    return risultato;
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
    // mese per mese: la somma dei netti è il netto annuo, 13ª e 14ª senza detrazioni né addizionali
    const somma = (nome) => r.mesi.righe.reduce((t, riga) => t + riga[nome], 0);
    console.assert(Math.abs(somma("netto") - r.nettoAnnuo) < 0.01, "somma mesi = netto annuo");
    console.assert(Math.abs(somma("comunale") - r.addizionali.comunale) < 0.01, "addizionale comunale in rate");
    console.assert(r.mesi.righe[13].comunale === 0 && r.mesi.righe[13].detrazioni === 0, "14ª senza detrazioni né addizionali");
    console.assert(r.mesi.righe[2].netto > r.mesi.righe[13].netto, "mese ordinario > 14ª");
    // figli21: 1 figlio a 30.000 → 950 × 65/95 ≈ 650
    console.log(calcolaNetto(30000, { ...base, familiari: { figli21: 1 } }).irpef.detrazioniFamiliari);
}
