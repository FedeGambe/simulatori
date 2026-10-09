# Simulatori

Simulatori interattivi in HTML, senza server né dipendenze: imposti i parametri e vedi subito il risultato.

Online: https://progetti.federicogamberini.it/simulatori/

| Simulatore | Cosa fa | Pagina |
|---|---|---|
| Conto deposito o conto corrente | Confronta il rendimento netto dopo imposta sugli interessi e bollo, anche dividendo la giacenza | `docs/cd-cc/` |
| Busta paga | Dalla RAL al netto annuo e mensile: INPS, IRPEF, detrazioni, cuneo fiscale L. 207/2024, addizionali | `docs/busta-paga/` |

## Struttura

- `docs/`: il sito pubblicato con GitHub Pages (`index.html` con le card, `simulatori.json` con l'elenco).
- `Busta Paga/`, `CD CC/`: config (`config/`) e funzioni di calcolo (`utils/`) di ogni simulatore.
  `node scripts/build-dashboard.js` le prepara per il browser (`script.js` in `docs/`): da rilanciare dopo ogni modifica.
- Prove rapide: `node utils/<nome>_function.js`.

Stime indicative, non consulenza fiscale. Nessun dato lascia il browser.
