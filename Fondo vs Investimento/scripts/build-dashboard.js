// Prepara per il browser la funzione di utils/ e le config: node scripts/build-dashboard.js
// Genera docs/fondo-vs-investimento/script.js (usa window.Fondo, cioè docs/fondo-pensione/script.js, che a sua volta usa window.Busta).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const radice = join(import.meta.dirname, "..");
const leggi = (p) => readFileSync(join(radice, p), "utf-8").replace(/\r\n/g, "\n");
const json = (p) => JSON.stringify(JSON.parse(leggi(p)));

// via import/export, le prove in coda (import.meta.main) e la lettura da disco
const corpo = leggi("utils/confronto_function.js")
    .replace(/^import .*\n/gm, "")
    .replace(/\n\/\/ prove:.*\nif \(import\.meta\.main\) \{[\s\S]*$/, "\n")
    .replace(/^const config = .*\n/m, `const config = ${json("config/confronto.json")};\n`)
    .replace(/^const fondoCfg = .*\n/m, `const fondoCfg = ${json("../Fondo Pensione/config/fondo.json")};\n`)
    .replace(/^export /gm, "");

const script = `// GENERATO da "Fondo vs Investimento"/scripts/build-dashboard.js: non modificare a mano.
(function () {
"use strict";
var simulaFondo = window.Fondo.simulaFondo;
${corpo.replace(/^\n+/, "")}
window.Confronto = { simulaConfronto: simulaConfronto, curvaBilanciamento: curvaBilanciamento, costoFondo: costoFondo, datoreDi: datoreDi, config: config };
})();
`;

writeFileSync(join(radice, "../docs/fondo-vs-investimento/script.js"), script);
console.log("ok", script.length, "byte");
