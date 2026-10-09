import { leggiConfig, arrotonda } from "./irpef_function.js";

const config = leggiConfig("contributi.json");

// l'imponibile previdenziale si arrotonda all'euro;
// il massimale vale solo per chi non ha contributi prima del 1996
export function calcolaImponibilePrevidenziale(lordoMensile, { massimale = false } = {}, contributi = config.contributi) {
    const imponibile = Math.round(lordoMensile);
    return massimale ? Math.min(imponibile, Math.round(contributi.massimale / 12)) : imponibile;
}

// 1% sulla parte del mese che supera la prima fascia pensionabile
export function calcolaContributoAggiuntivo(imponibile, contributi = config.contributi) {
    const aggiuntivo = contributi.contributoAggiuntivo;
    return Math.max(0, imponibile - aggiuntivo.sogliaMensile) * aggiuntivo.aliquota;
}

// altreVoci: voci inserite dall'utente (es. Ebitermo), con importo fisso o aliquota
// sull'imponibile previdenziale; deducibile = true se abbassano l'imponibile IRPEF
export function calcolaAltreVoci(imponibile, altreVoci = []) {
    return altreVoci.map((voce) => ({
        descrizione: voce.descrizione,
        importo: voce.importo ?? imponibile * voce.aliquota,
        deducibile: voce.deducibile ?? false,
    }));
}

// fondo: chiave di fondiIntegrazione (cigs, fisOltre5, fisFino5, fsba, fsbaOltre15, nessuno)
export function calcolaContributi(lordoMensile, { fondo = "nessuno", apprendista = false, massimale = false } = {}, contributi = config.contributi) {
    const fondoIntegrazione = contributi.fondiIntegrazione[fondo];
    if (!fondoIntegrazione) {
        throw new Error(`Fondo di integrazione sconosciuto: ${fondo}`);
    }

    const imponibile = calcolaImponibilePrevidenziale(lordoMensile, { massimale }, contributi);
    const ivs = imponibile * (apprendista ? contributi.ivs.apprendista : contributi.ivs.ordinario);
    const fondoImporto = imponibile * fondoIntegrazione.aliquota;
    const aggiuntivo = calcolaContributoAggiuntivo(imponibile, contributi);

    return {
        imponibile,
        ivs: arrotonda(ivs),
        fondo: arrotonda(fondoImporto),
        aggiuntivo: arrotonda(aggiuntivo),
        totale: arrotonda(ivs + fondoImporto + aggiuntivo),
    };
}

// i limiti delle deduzioni sono annui: nel mese si applica 1/12
export function calcolaDeduzioni({ previdenzaComplementare = 0, assistenzaSanitaria = 0 } = {}, deduzioni = config.deduzioni) {
    return Math.min(previdenzaComplementare, deduzioni.previdenzaComplementare.limite / 12)
        + Math.min(assistenzaSanitaria, deduzioni.assistenzaSanitaria.limite / 12);
}

// dal lordo all'imponibile IRPEF del mese:
// lordo − contributi INPS − altre voci deducibili − deduzioni
export function calcolaImponibileFiscale(lordoMensile, opzioni = {}) {
    const { altreVoci = [], deduzioni = {} } = opzioni;
    const contributi = calcolaContributi(lordoMensile, opzioni);
    const voci = calcolaAltreVoci(contributi.imponibile, altreVoci);

    const vociDeducibili = voci.filter((voce) => voce.deducibile).reduce((somma, voce) => somma + voce.importo, 0);
    const vociNonDeducibili = voci.filter((voce) => !voce.deducibile).reduce((somma, voce) => somma + voce.importo, 0);
    const importoDeduzioni = calcolaDeduzioni(deduzioni);

    return {
        lordo: lordoMensile,
        contributi,
        altreVoci: voci.map((voce) => ({ ...voce, importo: arrotonda(voce.importo) })),
        deduzioni: arrotonda(importoDeduzioni),
        imponibileFiscale: arrotonda(Math.max(0, lordoMensile - contributi.totale - vociDeducibili - importoDeduzioni)),
        // trattenute che si tolgono dal netto, dopo l'IRPEF
        trattenuteNette: arrotonda(vociNonDeducibili),
    };
}

// prove: si eseguono solo lanciando direttamente `node utils/contributi_function.js`
if (import.meta.main) {
    console.log(calcolaContributi(2000, { fondo: "fsba" })); // ivs 183.8, fondo 3, totale 186.8
    console.log(calcolaContributi(5000)); // aggiuntivo 3.15
    console.log(calcolaContributi(15000, { massimale: true }).imponibile); // 10191
    console.log(calcolaImponibileFiscale(2000, {
        fondo: "fsba",
        altreVoci: [{ descrizione: "Ebitermo", importo: 2.5 }],
        deduzioni: { previdenzaComplementare: 50 },
    }));
}
