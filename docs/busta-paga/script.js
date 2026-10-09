// GENERATO da scripts/build-dashboard.js: non modificare a mano.
(function () {
"use strict";
var CONFIG = {
"irpef.json": {"anno":2026,"scaglioni":{"fonte":"Art. 11 TUIR, modificato dalla Legge di Bilancio 2026 (L. 199/2025)","fasce":[{"da":0,"a":28000,"aliquota":0.23},{"da":28000,"a":50000,"aliquota":0.33},{"da":50000,"aliquota":0.43}]},"detrazioni":{"fonte":"Art. 13 c. 1 TUIR - detrazioni per lavoro dipendente","fasce":[{"da":0,"a":15000,"base":1955,"variabile":0},{"da":15000,"a":28000,"base":1910,"variabile":1190},{"da":28000,"a":50000,"base":0,"variabile":1910}],"maggiorazione":{"da":25000,"a":35000,"importo":65},"minimo":{"indeterminato":690,"determinato":1380}},"cuneoFiscale":{"fonte":"L. 207/2024 (Legge di Bilancio 2025), art. 1 c. 4-9","sommaEsente":{"fasce":[{"da":0,"a":8500,"percentuale":0.071},{"da":8500,"a":15000,"percentuale":0.053},{"da":15000,"a":20000,"percentuale":0.048}]},"ulterioreDetrazione":{"fasce":[{"da":20000,"a":32000,"base":1000,"variabile":0},{"da":32000,"a":40000,"base":0,"variabile":1000}]}},"detrazioniFamiliari":{"fonte":"Art. 12 TUIR. Figli under 21: assegno unico (fuori busta), nessuna detrazione","coniuge":{"fasce":[{"da":0,"a":15000,"base":800,"variabile":-110,"divisore":15000},{"da":15000,"a":15200,"fisso":710},{"da":15200,"a":15400,"fisso":720},{"da":15400,"a":15600,"fisso":730},{"da":15600,"a":29000,"fisso":690},{"da":29000,"a":29200,"fisso":700},{"da":29200,"a":34700,"fisso":710},{"da":34700,"a":35000,"fisso":720},{"da":35000,"a":35100,"fisso":710},{"da":35100,"a":35200,"fisso":705},{"da":35200,"a":40000,"fisso":690}],"oltre":{"da":40000,"a":80000,"importo":690}},"figlio21":{"importo":950,"importoDisabile":1350,"redditoMax":95000,"incrementoPerFiglio":15000},"altriFamiliari":{"importo":750,"redditoMax":80000}}},
"contributi.json": {"anno":2026,"contributi":{"fonte":"Circolare INPS n. 6 del 30/01/2026 - quote a carico del lavoratore","ivs":{"ordinario":0.0919,"apprendista":0.0584},"fondiIntegrazione":{"cigs":{"aliquota":0.003,"ambito":"industria oltre 15 dipendenti"},"fisOltre5":{"aliquota":0.002667,"ambito":"FIS oltre 5 dipendenti (1/3 di 0,80%)"},"fisFino5":{"aliquota":0.001667,"ambito":"FIS fino a 5 dipendenti (1/3 di 0,50%)"},"fsba":{"aliquota":0.0015,"ambito":"artigianato fino a 15 dipendenti (1/4 di 0,60%)"},"fsbaOltre15":{"aliquota":0.0025,"ambito":"artigianato oltre 15 dipendenti (1/4 di 1,00%)"},"nessuno":{"aliquota":0,"ambito":"nessun fondo"}},"contributoAggiuntivo":{"aliquota":0.01,"soglia":56224,"sogliaMensile":4685},"massimale":122295},"deduzioni":{"fonte":"Art. 10 c. 1 lett. e-bis e art. 51 c. 2 lett. a TUIR","previdenzaComplementare":{"limite":5164.57},"assistenzaSanitaria":{"limite":3615.2}}},
"addizionali-regionali.json": {"anno":2026,"fonte":"MEF - Dipartimento delle Finanze, aliquote addizionale regionale IRPEF 2026","note":"Le fasce si applicano a scaglioni, come l'IRPEF. Non sono gestite le agevolazioni legate a figli o disabilità: vanno inserite manualmente.","regioni":{"ABRUZZO":{"fasce":[{"da":0,"a":28000,"aliquota":0.0167},{"da":28000,"a":50000,"aliquota":0.0287},{"da":50000,"aliquota":0.0333}]},"BASILICATA":{"fasce":[{"da":0,"aliquota":0.0123}]},"BOLZANO":{"fasce":[{"da":0,"a":50000,"aliquota":0.0123},{"da":50000,"aliquota":0.0173}],"detrazioni":[{"da":0,"a":90000,"importo":430.5},{"da":50000,"importo":125,"rampa":25000}]},"CALABRIA":{"fasce":[{"da":0,"aliquota":0.0173}]},"CAMPANIA":{"fasce":[{"da":0,"a":15000,"aliquota":0.0173},{"da":15000,"a":28000,"aliquota":0.0296},{"da":28000,"a":50000,"aliquota":0.032},{"da":50000,"aliquota":0.0333}]},"EMILIA-ROMAGNA":{"fasce":[{"da":0,"a":15000,"aliquota":0.0133},{"da":15000,"a":28000,"aliquota":0.0193},{"da":28000,"a":50000,"aliquota":0.0278},{"da":50000,"aliquota":0.0333}]},"FRIULI VENEZIA GIULIA":{"fasce":[{"da":0,"aliquota":0.0123}],"aliquotaRidotta":{"fino":15000,"aliquota":0.007}},"LAZIO":{"fasce":[{"da":0,"a":15000,"aliquota":0.0173},{"da":15000,"aliquota":0.0333}],"aliquotaRidotta":{"fino":28000,"aliquota":0.0173},"detrazioni":[{"da":28000,"a":30000,"importo":60}]},"LIGURIA":{"fasce":[{"da":0,"a":28000,"aliquota":0.0123},{"da":28000,"a":50000,"aliquota":0.0318},{"da":50000,"aliquota":0.0323}]},"LOMBARDIA":{"fasce":[{"da":0,"a":15000,"aliquota":0.0123},{"da":15000,"a":28000,"aliquota":0.0158},{"da":28000,"a":50000,"aliquota":0.0172},{"da":50000,"aliquota":0.0173}]},"MARCHE":{"fasce":[{"da":0,"a":15000,"aliquota":0.0123},{"da":15000,"a":28000,"aliquota":0.0153},{"da":28000,"a":50000,"aliquota":0.017},{"da":50000,"aliquota":0.0173}]},"MOLISE":{"fasce":[{"da":0,"a":15000,"aliquota":0.0203},{"da":15000,"a":28000,"aliquota":0.0223},{"da":28000,"aliquota":0.0363}]},"PIEMONTE":{"fasce":[{"da":0,"a":15000,"aliquota":0.0162},{"da":15000,"a":28000,"aliquota":0.0268},{"da":28000,"a":50000,"aliquota":0.0331},{"da":50000,"aliquota":0.0333}]},"PUGLIA":{"fasce":[{"da":0,"a":15000,"aliquota":0.0133},{"da":15000,"a":28000,"aliquota":0.0213},{"da":28000,"a":50000,"aliquota":0.0323},{"da":50000,"aliquota":0.0333}]},"SARDEGNA":{"fasce":[{"da":0,"aliquota":0.0123}]},"SICILIA":{"fasce":[{"da":0,"aliquota":0.0123}]},"TOSCANA":{"fasce":[{"da":0,"a":15000,"aliquota":0.0142},{"da":15000,"a":28000,"aliquota":0.0143},{"da":28000,"a":50000,"aliquota":0.0332},{"da":50000,"aliquota":0.0333}]},"TRENTO":{"fasce":[{"da":0,"a":50000,"aliquota":0.0123},{"da":50000,"aliquota":0.0173}],"esenzione":30000},"UMBRIA":{"fasce":[{"da":0,"a":15000,"aliquota":0.0173},{"da":15000,"a":28000,"aliquota":0.0302},{"da":28000,"a":50000,"aliquota":0.0312},{"da":50000,"aliquota":0.0333}],"aliquotaRidotta":{"fino":28000,"aliquota":0.0123},"detrazioni":[{"da":28000,"a":50000,"importo":150}]},"VALLE D'AOSTA":{"fasce":[{"da":0,"aliquota":0.0123}],"esenzione":15000},"VENETO":{"fasce":[{"da":0,"aliquota":0.0123}]}},"province":{"AG":"SICILIA","AL":"PIEMONTE","AN":"MARCHE","AO":"VALLE D'AOSTA","AP":"MARCHE","AQ":"ABRUZZO","AR":"TOSCANA","AT":"PIEMONTE","AV":"CAMPANIA","BA":"PUGLIA","BG":"LOMBARDIA","BI":"PIEMONTE","BL":"VENETO","BN":"CAMPANIA","BO":"EMILIA-ROMAGNA","BR":"PUGLIA","BS":"LOMBARDIA","BT":"PUGLIA","BZ":"BOLZANO","CA":"SARDEGNA","CB":"MOLISE","CE":"CAMPANIA","CH":"ABRUZZO","CL":"SICILIA","CN":"PIEMONTE","CO":"LOMBARDIA","CR":"LOMBARDIA","CS":"CALABRIA","CT":"SICILIA","CZ":"CALABRIA","EN":"SICILIA","FC":"EMILIA-ROMAGNA","FE":"EMILIA-ROMAGNA","FG":"PUGLIA","FI":"TOSCANA","FM":"MARCHE","FR":"LAZIO","GE":"LIGURIA","GO":"FRIULI VENEZIA GIULIA","GR":"TOSCANA","IM":"LIGURIA","IS":"MOLISE","KR":"CALABRIA","LC":"LOMBARDIA","LE":"PUGLIA","LI":"TOSCANA","LO":"LOMBARDIA","LT":"LAZIO","LU":"TOSCANA","MB":"LOMBARDIA","MC":"MARCHE","ME":"SICILIA","MI":"LOMBARDIA","MN":"LOMBARDIA","MO":"EMILIA-ROMAGNA","MS":"TOSCANA","MT":"BASILICATA","NA":"CAMPANIA","NO":"PIEMONTE","NU":"SARDEGNA","OR":"SARDEGNA","PA":"SICILIA","PC":"EMILIA-ROMAGNA","PD":"VENETO","PE":"ABRUZZO","PG":"UMBRIA","PI":"TOSCANA","PN":"FRIULI VENEZIA GIULIA","PO":"TOSCANA","PR":"EMILIA-ROMAGNA","PT":"TOSCANA","PU":"MARCHE","PV":"LOMBARDIA","PZ":"BASILICATA","RA":"EMILIA-ROMAGNA","RC":"CALABRIA","RE":"EMILIA-ROMAGNA","RG":"SICILIA","RI":"LAZIO","RM":"LAZIO","RN":"EMILIA-ROMAGNA","RO":"VENETO","SA":"CAMPANIA","SI":"TOSCANA","SO":"LOMBARDIA","SP":"LIGURIA","SR":"SICILIA","SS":"SARDEGNA","SU":"SARDEGNA","SV":"LIGURIA","TA":"PUGLIA","TE":"ABRUZZO","TN":"TRENTO","TO":"PIEMONTE","TP":"SICILIA","TR":"UMBRIA","TS":"FRIULI VENEZIA GIULIA","TV":"VENETO","UD":"FRIULI VENEZIA GIULIA","VA":"LOMBARDIA","VB":"PIEMONTE","VC":"PIEMONTE","VE":"VENETO","VI":"VENETO","VR":"VENETO","VT":"LAZIO","VV":"CALABRIA"},"rate":{"regionale":11,"comunaleSaldo":11,"comunaleAcconto":{"percentuale":0.3,"rate":9}}},
"addizionali-comunali.json": window.COMUNI
};

function leggiConfig(nome) {
    return CONFIG[nome];
}

const irpef = leggiConfig("irpef.json");

function arrotonda(valore) {
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

function calcolaIrpefLorda(reddito, scaglioni = irpef.scaglioni.fasce) {
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
function calcolaDetrazioni(reddito, { giorni = 365, tempoDeterminato = false } = {}, detrazioni = irpef.detrazioni) {
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
function calcolaSommaEsente(reddito, cuneo = irpef.cuneoFiscale) {
    const fascia = trovaFascia(reddito, cuneo.sommaEsente.fasce);
    return fascia ? reddito * fascia.percentuale : 0;
}

// cuneo fiscale, redditi tra 20.000 e 40.000: detrazione aggiuntiva fino a 1.000
function calcolaUlterioreDetrazione(reddito, cuneo = irpef.cuneoFiscale) {
    const fascia = trovaFascia(reddito, cuneo.ulterioreDetrazione.fasce);
    return fascia ? importoFascia(reddito, fascia) : 0;
}

// art. 12 TUIR. familiari: { coniuge, figli21, figliDisabili21, altri, quota }
// quota: parte spettante a chi calcola (1 = tutta, 0.5 = ripartita al 50% tra i genitori)
function calcolaDetrazioniFamiliari(reddito, { coniuge = false, figli21 = 0, figliDisabili21 = 0, altri = 0, quota = 1 } = {}, config = irpef.detrazioniFamiliari) {
    let totale = 0;

    if (coniuge) {
        const fascia = trovaFascia(reddito, config.coniuge.fasce);
        const { oltre } = config.coniuge;
        if (fascia?.fisso !== undefined) {
            totale += fascia.fisso;
        } else if (fascia) {
            totale += fascia.base + fascia.variabile * reddito / fascia.divisore;
        } else if (reddito > oltre.da && reddito <= oltre.a) {
            totale += oltre.importo * (oltre.a - reddito) / (oltre.a - oltre.da);
        }
    }

    const figli = figli21 + figliDisabili21;
    if (figli > 0) {
        const f = config.figlio21;
        const massimo = f.redditoMax + f.incrementoPerFiglio * (figli - 1);
        const fattore = Math.max(0, (massimo - reddito) / massimo);
        totale += (figli21 * f.importo + figliDisabili21 * f.importoDisabile) * fattore;
    }

    const a = config.altriFamiliari;
    totale += altri * a.importo * Math.max(0, (a.redditoMax - reddito) / a.redditoMax);

    return totale * quota;
}

function calcolaIrpef(reddito, opzioni = {}) {
    const lorda = calcolaIrpefLorda(reddito);
    const detrazioni = calcolaDetrazioni(reddito, opzioni);
    const ulterioreDetrazione = calcolaUlterioreDetrazione(reddito);
    const detrazioniFamiliari = calcolaDetrazioniFamiliari(reddito, opzioni.familiari);
    // le detrazioni non possono portare l'imposta sotto zero
    const netta = Math.max(0, lorda - detrazioni - ulterioreDetrazione - detrazioniFamiliari);

    return {
        reddito,
        lorda: arrotonda(lorda),
        detrazioni: arrotonda(detrazioni),
        ulterioreDetrazione: arrotonda(ulterioreDetrazione),
        detrazioniFamiliari: arrotonda(detrazioniFamiliari),
        netta: arrotonda(netta),
        sommaEsente: arrotonda(calcolaSommaEsente(reddito)),
        aliquotaMedia: reddito > 0 ? arrotonda((netta / reddito) * 100) : 0,
    };
}

// come in Excel: dall'imponibile del mese si ricava il reddito annuo,
// si calcola l'IRPEF annua e la si divide sulle mensilità
function calcolaIrpefMensile(imponibileMensile, mensilita = 14, opzioni = {}) {
    const annua = calcolaIrpef(imponibileMensile * mensilita, opzioni);
    return {
        ...annua,
        nettaMensile: arrotonda(annua.netta / mensilita),
        sommaEsenteMensile: arrotonda(annua.sommaEsente / mensilita),
    };
}



const config = leggiConfig("contributi.json");

// l'imponibile previdenziale si arrotonda all'euro;
// il massimale vale solo per chi non ha contributi prima del 1996
function calcolaImponibilePrevidenziale(lordoMensile, { massimale = false } = {}, contributi = config.contributi) {
    const imponibile = Math.round(lordoMensile);
    return massimale ? Math.min(imponibile, Math.round(contributi.massimale / 12)) : imponibile;
}

// 1% sulla parte del mese che supera la prima fascia pensionabile
function calcolaContributoAggiuntivo(imponibile, contributi = config.contributi) {
    const aggiuntivo = contributi.contributoAggiuntivo;
    return Math.max(0, imponibile - aggiuntivo.sogliaMensile) * aggiuntivo.aliquota;
}

// altreVoci: voci inserite dall'utente (es. Ebitermo), con importo fisso o aliquota
// sull'imponibile previdenziale; deducibile = true se abbassano l'imponibile IRPEF
function calcolaAltreVoci(imponibile, altreVoci = []) {
    return altreVoci.map((voce) => ({
        descrizione: voce.descrizione,
        importo: voce.importo ?? imponibile * voce.aliquota,
        deducibile: voce.deducibile ?? false,
    }));
}

// fondo: chiave di fondiIntegrazione (cigs, fisOltre5, fisFino5, fsba, fsbaOltre15, nessuno)
function calcolaContributi(lordoMensile, { fondo = "nessuno", apprendista = false, massimale = false } = {}, contributi = config.contributi) {
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
// il limite della previdenza complementare è unico per quota lavoratore e quota ditta:
// la quota ditta non entra nel lordo, ma consuma parte del limite
function calcolaDeduzioni({ previdenzaComplementare = 0, previdenzaComplementareDitta = 0, assistenzaSanitaria = 0 } = {}, deduzioni = config.deduzioni) {
    const limitePrevidenza = deduzioni.previdenzaComplementare.limite / 12;
    return Math.min(previdenzaComplementare, Math.max(0, limitePrevidenza - previdenzaComplementareDitta))
        + Math.min(assistenzaSanitaria, deduzioni.assistenzaSanitaria.limite / 12);
}

// dal lordo all'imponibile IRPEF del mese:
// lordo − contributi INPS − altre voci deducibili − deduzioni
function calcolaImponibileFiscale(lordoMensile, opzioni = {}) {
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
function calcolaAddizionale(reddito, regole) {
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
function cercaComuni(testo, limite = 20) {
    const cerca = testo.trim().toUpperCase();
    if (!cerca) {
        return [];
    }
    return Object.entries(comunali.comuni)
        .filter(([, comune]) => comune.nome.startsWith(cerca))
        .slice(0, limite)
        .map(([codice, comune]) => ({ codice, nome: comune.nome, pr: comune.pr }));
}

function trovaComune(codice) {
    const comune = comunali.comuni[codice];
    if (!comune) {
        throw new Error(`Comune sconosciuto: ${codice}`);
    }
    return { codice, ...comune, regione: regionali.province[comune.pr] };
}

function elencoRegioni() {
    return Object.keys(regionali.regioni);
}

// reddito: imponibile IRPEF annuo
// comune: codice catastale (es. "F257" Modena), da cui si ricava anche la regione
// regione / comunale: per sovrascrivere i default, con il nome della regione,
//   un'aliquota unica (0.0123) o regole complete ({ fasce, esenzione, ... })
// irpefNetta: se è 0 le addizionali non sono dovute
function calcolaAddizionali(reddito, { comune, regione, comunale, irpefNetta } = {}) {
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



// dalla RAL al netto annuo e mensile.
// opzioni: mensilita (12/13/14), fondo, apprendista, massimale, altreVoci, deduzioni (importi mensili),
//   giorni, tempoDeterminato, familiari ({ coniuge, figli21, ... }), comune / regione (addizionali)
// semplificazioni: addizionali = totale annuo / mensilità (non le rate reali), TFR e assegno unico esclusi
function calcolaNetto(ral, { mensilita = 14, ...opzioni } = {}) {
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


window.Busta = { calcolaNetto: calcolaNetto, cercaComuni: cercaComuni, trovaComune: trovaComune, elencoRegioni: elencoRegioni, anno: CONFIG["irpef.json"].anno };
})();
