// Prepara per il browser la funzione di utils/ e la config: node scripts/build-dashboard.js
// Genera docs/fondo-pensione/script.js (usa window.Busta, cioè docs/busta-paga/script.js, per l'IRPEF).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const radice = join(import.meta.dirname, "..");
const leggi = (p) => readFileSync(join(radice, p), "utf-8").replace(/\r\n/g, "\n");
const config = JSON.stringify(JSON.parse(leggi("config/fondo.json")));

// via import/export, le prove in coda (import.meta.main) e la lettura da disco
const corpo = leggi("utils/fondo_function.js")
    .replace(/^import .*\n/gm, "")
    .replace(/\n\/\/ prove:.*\nif \(import\.meta\.main\) \{[\s\S]*$/, "\n")
    .replace(/^const config = .*\n/m, `const config = ${config};\n`)
    .replace(/^export /gm, "");

const script = `// GENERATO da "Fondo Pensione"/scripts/build-dashboard.js: non modificare a mano.
(function () {
"use strict";
var Busta = window.Busta, calcolaNetto = Busta.calcolaNetto, calcolaDeduzioni = Busta.calcolaDeduzioni;
${corpo.replace(/^\n+/, "")}
window.Fondo = { simulaFondo: simulaFondo };
})();
`;

writeFileSync(join(radice, "../docs/fondo-pensione/script.js"), script);
console.log("ok", script.length, "byte");
