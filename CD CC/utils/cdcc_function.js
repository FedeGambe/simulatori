import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert";

const costi = JSON.parse(readFileSync(join(import.meta.dirname, "../config/costi.json"), "utf-8"));

const IMPOSTA_RENDIMENTO = costi.impostaRendimento;   // % sugli interessi, CC e CD
const IMPOSTA_GIACENZA = costi.impostaGiacenza;       // € all'anno, solo CC
const LIMITE_GIACENZA = costi.limiteGiacenza;         // € sopra cui il CC paga il bollo
const IMPOSTA_BOLLO = costi.impostaBollo;             // % all'anno sulla giacenza, solo CD

export function interessiLordi(giacenza, tasso, anni) {
    return giacenza * tasso / 100 * anni;
}

export function nettoDopoImposta(lordo) {
    return lordo - (lordo * IMPOSTA_RENDIMENTO / 100);
}

export function bolloCC(giacenza, anni) {
    if (giacenza > LIMITE_GIACENZA) {
        return IMPOSTA_GIACENZA * anni;
    }
    return 0;
}

export function bolloCD(giacenza, anni) {
    return giacenza * (IMPOSTA_BOLLO / 100) * anni;
}

export function nettoCC(giacenza, tasso, anni) {
    return nettoDopoImposta(interessiLordi(giacenza, tasso, anni)) - bolloCC(giacenza, anni);
}

export function nettoCD(giacenza, tasso, anni) {
    return nettoDopoImposta(interessiLordi(giacenza, tasso, anni)) - bolloCD(giacenza, anni);
}

export function conviene(giacenza, tassoCC, tassoCD, anni) {
    const cc = nettoCC(giacenza, tassoCC, anni);
    const cd = nettoCD(giacenza, tassoCD, anni);
    if (cc > cd) {
        return "CC";
    }
    return "CD";
}

// Netto con una parte della giacenza nel CC e il resto nel CD.
export function nettoSplit(giacenza, quotaCC, tassoCC, tassoCD, anni) {
    return nettoCC(quotaCC, tassoCC, anni) + nettoCD(giacenza - quotaCC, tassoCD, anni);
}

// Quota migliore da mettere nel CC. Il netto è una retta con un salto a LIMITE_GIACENZA
// (sopra la soglia scatta il bollo fisso), quindi il massimo è in uno di tre punti:
// niente nel CC, esattamente la soglia (ultimo euro senza bollo), tutto nel CC.
export function migliorSplit(giacenza, tassoCC, tassoCD, anni) {
    const candidati = [0, Math.min(LIMITE_GIACENZA, giacenza), giacenza];
    let migliore = candidati[0];
    for (const quota of candidati) {
        if (nettoSplit(giacenza, quota, tassoCC, tassoCD, anni) > nettoSplit(giacenza, migliore, tassoCC, tassoCD, anni)) {
            migliore = quota;
        }
    }
    return migliore;
}

export function euro(x) {
    return Math.round(x * 100) / 100;
}

// prove: si eseguono solo lanciando direttamente `node utils/cdcc_function.js`
if (import.meta.main) {
    assert.strictEqual(euro(nettoCC(20000, 2.5, 1)), 335.8);
    assert.strictEqual(euro(nettoCD(20000, 3, 1)), 404);
    assert.strictEqual(bolloCC(5000, 1), 0);
    assert.strictEqual(euro(bolloCC(5001, 2)), 68.4);
    assert.strictEqual(conviene(4000, 2.5, 2, 1), "CC");
    assert.strictEqual(euro(nettoSplit(10000, 5000, 2.5, 3, 1)), 92.5 + 5000 * 0.03 * 0.74 - 10);
    assert.strictEqual(migliorSplit(10000, 2.5, 3, 1), 0);         // CD rende di più: tutto lì
    assert.strictEqual(migliorSplit(10000, 3, 2.5, 1), 5000);      // CC rende di più: 5000 senza bollo, il resto nel CD
    assert.strictEqual(migliorSplit(3000, 3, 2.5, 1), 3000);       // sotto soglia: tutto CC
    assert.strictEqual(migliorSplit(1000000, 3, 2.5, 1), 1000000); // cifra enorme: il bollo fisso non pesa
    console.log("test ok");
}
