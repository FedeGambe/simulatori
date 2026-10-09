// Prepara per il browser le funzioni di utils/ e la config: node scripts/build-dashboard.js
// Genera docs/cd-cc/script.js (funzioni e costanti globali, usate da dashboard.js).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const radice = join(import.meta.dirname, "..");
const leggi = (p) => readFileSync(join(radice, p), "utf-8").replace(/\r\n/g, "\n");
const costi = JSON.stringify(JSON.parse(leggi("config/costi.json")));

// via import/export, le prove in coda (import.meta.main) e la lettura da disco
const corpo = leggi("utils/cdcc_function.js")
    .replace(/^import .*\n/gm, "")
    .replace(/\n\/\/ prove:.*\nif \(import\.meta\.main\) \{[\s\S]*$/, "\n")
    .replace(/^const costi = .*\n/m, `const costi = ${costi};\n`)
    .replace(/^export /gm, "");

writeFileSync(join(radice, "../docs/cd-cc/script.js"), `// GENERATO da "CD CC"/scripts/build-dashboard.js: non modificare a mano.\n${corpo.replace(/^\n+/, "")}`);
console.log("ok");
