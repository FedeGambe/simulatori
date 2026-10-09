// Scarica dal MEF le aliquote dell'addizionale comunale IRPEF di tutti i comuni
// e genera config/addizionali-comunali.json.
// Uso: node scripts/aggiorna-addizionali-comunali.js 2026
//
// Se un comune non ha ancora pubblicato la delibera dell'anno (aliquota "0*"),
// si usa quella dell'anno precedente: le aliquote restano valide finché non cambiano.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const URL_MEF = "https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php";
const anno = Number(process.argv[2] ?? new Date().getFullYear());

async function scaricaCsv(anno) {
    const risposta = await fetch(`${URL_MEF}?anno=${anno}`);
    if (!risposta.ok) {
        throw new Error(`Download MEF ${anno} fallito: ${risposta.status}`);
    }
    const [intestazione, ...righe] = (await risposta.text()).trim().split(/\r?\n/);
    const colonne = intestazione.split(";");
    return righe.map((riga) => {
        const valori = riga.split(";");
        return Object.fromEntries(colonne.map((colonna, i) => [colonna, valori[i] ?? ""]));
    });
}

// "28.000,00" -> 28000
function numeri(testo) {
    return (testo.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) ?? [])
        .map((n) => Number(n.replaceAll(".", "").replace(",", ".")));
}

// ",76" -> 0.0076
function aliquota(testo) {
    return Number((Number(testo.replace(",", ".")) / 100).toFixed(6));
}

function converti(riga, annoDati) {
    const comune = { nome: riga.COMUNE, pr: riga.PR, anno: annoDati, fasce: [] };
    const avvisi = [];

    for (let i = 1; i <= 12; i++) {
        const suffisso = i === 1 ? "" : `_${i}`;
        const valore = riga[`ALIQUOTA${suffisso}`];
        const descrizione = riga[`FASCIA${suffisso}`].trim();
        if (!descrizione) {
            continue;
        }

        if (/^esenzione per (i )?redditi( imponibili)? fino a/i.test(descrizione)) {
            comune.esenzione = numeri(descrizione).at(-1);
        } else if (/esenzion/i.test(descrizione)) {
            // esenzioni per categorie (pensionati, ecc.): non gestite in automatico
            avvisi.push(descrizione);
        } else if (/aliquota unica/i.test(descrizione)) {
            comune.fasce = [{ da: 0, aliquota: aliquota(valore) }];
        } else if (/applicabile/i.test(descrizione)) {
            const valori = numeri(descrizione);
            const senzaLimite = valori.length === 1 && /oltre|\bda\b/i.test(descrizione) && !/fino/i.test(descrizione);
            const da = comune.fasce.at(-1)?.a ?? 0;
            const a = senzaLimite ? undefined : Math.round(valori.at(-1));
            comune.fasce.push({ da, a, aliquota: aliquota(valore) });
        } else {
            avvisi.push(descrizione);
        }
    }

    const fasceOrdinate = comune.fasce.every((fascia) => fascia.a === undefined || fascia.a > fascia.da);
    if (!comune.fasce.length || !fasceOrdinate) {
        avvisi.push("aliquote non interpretabili in automatico");
    }
    if (avvisi.length) {
        comune.daVerificare = avvisi;
    }
    return comune;
}

const [attuale, precedente] = await Promise.all([scaricaCsv(anno), scaricaCsv(anno - 1)]);
const precedentePerCodice = new Map(precedente.map((riga) => [riga.CODICE_CATASTALE, riga]));

const comuni = {};
const conteggio = { attuale: 0, precedente: 0, senzaAddizionale: 0, daVerificare: 0 };

for (const riga of attuale) {
    let fonte = riga;
    let annoDati = anno;
    if (riga.ALIQUOTA === "0*") {
        fonte = precedentePerCodice.get(riga.CODICE_CATASTALE) ?? riga;
        annoDati = anno - 1;
    }

    if (fonte.ALIQUOTA === "0*") {
        comuni[riga.CODICE_CATASTALE] = { nome: riga.COMUNE, pr: riga.PR, anno: null, fasce: [] };
        conteggio.senzaAddizionale++;
        continue;
    }

    const comune = converti(fonte, annoDati);
    comuni[riga.CODICE_CATASTALE] = comune;
    conteggio[annoDati === anno ? "attuale" : "precedente"]++;
    if (comune.daVerificare) {
        conteggio.daVerificare++;
    }
}

const output = {
    anno,
    fonte: "MEF - Dipartimento delle Finanze, elenco aliquote addizionale comunale IRPEF",
    generato: new Date().toISOString().slice(0, 10),
    comuni,
};
// un comune per riga: "F257": { "nome": "MODENA", "pr": "MO", ... }
function inLinea(valore) {
    if (Array.isArray(valore)) {
        return `[${valore.map(inLinea).join(", ")}]`;
    }
    if (valore && typeof valore === "object") {
        const campi = Object.entries(valore)
            .filter(([, v]) => v !== undefined)
            .map(([chiave, v]) => `${JSON.stringify(chiave)}: ${inLinea(v)}`);
        return `{ ${campi.join(", ")} }`;
    }
    return JSON.stringify(valore);
}
const righeComuni = Object.entries(comuni).map(([codice, comune]) => `    "${codice}": ${inLinea(comune)}`);
const json = [
    "{",
    `  "anno": ${output.anno},`,
    `  "fonte": ${JSON.stringify(output.fonte)},`,
    `  "generato": ${JSON.stringify(output.generato)},`,
    `  "comuni": {`,
    righeComuni.join(",\n"),
    "  }",
    "}",
].join("\n");
writeFileSync(join(import.meta.dirname, "../config/addizionali-comunali.json"), json + "\n");

console.log(`Comuni: ${attuale.length}`);
console.log(`  delibera ${anno}: ${conteggio.attuale}`);
console.log(`  delibera ${anno - 1} (in vigore): ${conteggio.precedente}`);
console.log(`  senza addizionale: ${conteggio.senzaAddizionale}`);
console.log(`  da verificare: ${conteggio.daVerificare}`);
