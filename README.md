# Simulatori

Simulatori interattivi in HTML, senza server né dipendenze: imposti i parametri e vedi subito il risultato.

Online: https://progetti.federicogamberini.it/simulatori/

| Simulatore | Cosa fa | Pagina |
|---|---|---|
| Conto deposito o conto corrente | Confronta il rendimento netto dopo imposta sugli interessi e bollo, anche dividendo la giacenza | `docs/cd-cc/` |
| Busta paga | Dalla RAL al netto annuo e mensile: INPS, IRPEF, detrazioni, cuneo fiscale L. 207/2024, addizionali | `docs/busta-paga/` |
| Fondo pensione | Crescita del fondo anno per anno, risparmio IRPEF grazie alla deducibilità, tassa sulla prestazione | `docs/fondo-pensione/` |
| Fondo pensione o investimento | A parità di costo di tasca, fondo pensione contro azioni o obbligazioni fuori dal fondo, con cursori per importi e bilanciamento | `docs/fondo-vs-investimento/` |

## Struttura

- `docs/`: il sito pubblicato con GitHub Pages (`index.html` con le card, `simulatori.json` con l'elenco).
- `Busta Paga/`, `CD CC/`, `Fondo Pensione/`, `Fondo vs Investimento/`: config (`config/`) e funzioni di calcolo (`utils/`) di ogni simulatore.
  `node scripts/build-dashboard.js` le prepara per il browser (`script.js` in `docs/`, generati: non modificarli a mano).
- Il fondo pensione usa il motore della busta paga (`window.Busta`): in `docs/fondo-pensione/` la pagina carica `../busta-paga/script.js`. Il confronto fondo/investimento usa a sua volta il motore del fondo (`window.Fondo`).
- `sh scripts/build.sh` lancia le prove (`utils/*_function.js`) e tutti i build, nell'ordine giusto.

## Build automatico

Gli script in `docs/` si rigenerano da soli quando cambia il codice di un simulatore:

- **Hook pre-commit** (`.githooks/pre-commit`): se il commit tocca un simulatore, lancia `scripts/build.sh` e aggiunge al commit gli script rigenerati; se una prova fallisce il commit si ferma. Si attiva una volta per clone con `git config core.hooksPath .githooks`.
- **GitHub Action** (`.github/workflows/build.yml`): a ogni push su `main` che tocca un simulatore rifà prove e build e, se `docs/` cambia, fa un commit da sola. In quel caso prima del push successivo serve `git pull`.

Stime indicative, non consulenza fiscale. Nessun dato lascia il browser.
