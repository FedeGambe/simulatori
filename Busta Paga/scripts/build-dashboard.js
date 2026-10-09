// Prepara per il browser le funzioni di utils/ e le config: node scripts/build-dashboard.js
// Genera docs/script.js (calcoli) e docs/comuni.js (addizionali comunali).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const radice = join(import.meta.dirname, "..");
const uscita = join(radice, "docs");
const leggi = (p) => readFileSync(join(radice, p), "utf-8").replace(/\r\n/g, "\n");
const json = (nome) => JSON.stringify(JSON.parse(leggi(`config/${nome}`)));

// via import/export, le prove in coda (import.meta.main) e la lettura da disco
const adatta = (testo) => testo
    .replace(/^import .*\n/gm, "")
    .replace(/\n\/\/ prove:.*\nif \(import\.meta\.main\) \{[\s\S]*$/, "\n")
    .replace(/\nif \(import\.meta\.main\) \{[\s\S]*$/, "\n")
    .replace(/^export /gm, "");

const irpef = adatta(leggi("utils/irpef_function.js"))
    .replace(/function leggiConfig[\s\S]*?\n\}\n/, "function leggiConfig(nome) {\n    return CONFIG[nome];\n}\n");

const corpo = ["contributi_function", "addizionali_function", "netto_function"].map((f) => adatta(leggi(`utils/${f}.js`))).join("\n");

const script = `// GENERATO da scripts/build-dashboard.js: non modificare a mano.
(function () {
"use strict";
var CONFIG = {
"irpef.json": ${json("irpef.json")},
"contributi.json": ${json("contributi.json")},
"addizionali-regionali.json": ${json("addizionali-regionali.json")},
"addizionali-comunali.json": window.COMUNI
};
${irpef}
${corpo}
window.Busta = { calcolaNetto: calcolaNetto, cercaComuni: cercaComuni, trovaComune: trovaComune, elencoRegioni: elencoRegioni, anno: CONFIG["irpef.json"].anno };
})();
`;

writeFileSync(join(uscita, "script.js"), script);
writeFileSync(join(uscita, "comuni.js"), `// GENERATO da scripts/build-dashboard.js: addizionali comunali (fonte MEF).\nwindow.COMUNI = ${json("addizionali-comunali.json")};\n`);
console.log("ok", script.length, "byte");
