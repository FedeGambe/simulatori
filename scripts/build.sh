#!/bin/sh
# Prove e build di tutti i simulatori: rigenera gli script per il browser in docs/
# (docs/*/script.js e docs/busta-paga/comuni.js) a partire da utils/ e config/.
# Lo usano l'hook pre-commit (.githooks/pre-commit) e la GitHub Action (.github/workflows/build.yml).
# Uso: sh scripts/build.sh
set -e
cd "$(dirname "$0")/.."

# la busta paga per prima: il fondo pensione usa il suo motore, il confronto usa quello del fondo
for simulatore in "Busta Paga" "CD CC" "Fondo Pensione" "Fondo vs Investimento"; do
    # prove: console.assert non fa fallire node, quindi si cerca "Assertion failed" nell'output
    for prova in "$simulatore"/utils/*_function.js; do
        if ! uscita=$(node "$prova" 2>&1); then
            echo "Errore in $prova:"; echo "$uscita"; exit 1
        fi
        if echo "$uscita" | grep -q "Assertion failed"; then
            echo "Prova fallita in $prova:"; echo "$uscita" | grep "Assertion failed"; exit 1
        fi
    done
    node "$simulatore/scripts/build-dashboard.js" > /dev/null
    echo "ok $simulatore"
done
