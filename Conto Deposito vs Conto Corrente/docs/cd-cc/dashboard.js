// INTERFACCIA: legge le caselle, usa le funzioni di script.js, scrive nella pagina.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var eur = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR"});
  var pct = new Intl.NumberFormat("it-IT", {minimumFractionDigits: 2, maximumFractionDigits: 2});

  // id: [predefinito, minimo, massimo, nome per l'errore]
  var CAMPI = {
    giacenza: [10000, 1, 1e8, "Giacenza"],
    anni: [1, 0.5, 50, "Durata"],
    tassoCC: [3, 0, 20, "Tasso CC"],
    tassoCD: [3, 0, 20, "Tasso CD"],
    quotaCC: [5000, 0, 1e8, "Quota CC"]
  };
  var PRESET = {a: 3000, b: 10000, c: 50000};
  var uguali = true;    // tassi appaiati: un solo tasso per CC e CD
  var dividi = false;   // la suddivisione CC/CD è opzionale: parte spenta

  function mostraTassi() {
    $("diversi").setAttribute("aria-pressed", !uguali);
    $("campo-tassoCD").hidden = uguali;
    $("et-tassoCC").textContent = uguali ? "Conto corrente e conto deposito" : "Conto corrente";
    $("coppia-tassi").classList.toggle("due", !uguali);
    if (uguali) $("tassoCD").value = $("tassoCC").value;
  }

  function mostraDividi() {
    $("dividi").setAttribute("aria-pressed", dividi);
    $("dividi-on").hidden = !dividi;
  }

  // 1. leggo e controllo i valori; se uno è sbagliato mostro l'errore e restituisco null
  function leggi() {
    var v = {}, ok = true;
    Object.keys(CAMPI).forEach(function (id) {
      if (id === "quotaCC" && !dividi) { v.quotaCC = 0; return; }
      var c = CAMPI[id], el = $(id), err = $(id + "-e");
      var n = parseFloat(String(el.value).replace(",", "."));
      var bad = isNaN(n) || n < c[1] || n > c[2];
      el.setAttribute("aria-invalid", bad);
      err.hidden = !bad;
      err.textContent = bad ? c[3] + ": inserisci un valore tra " + c[1] + " e " + c[2] + "." : "";
      if (bad) ok = false; else v[id] = n;
    });
    if (ok && dividi && v.quotaCC > v.giacenza) {
      $("quotaCC").setAttribute("aria-invalid", true);
      $("quotaCC-e").hidden = false;
      $("quotaCC-e").textContent = "La quota nel CC non può superare la giacenza.";
      ok = false;
    }
    return ok ? v : null;
  }

  // 2. riga di una barra: parte da "da" e arriva ad "a", su una scala comune
  function riga(nome, da, a, scala, classe, testo, finale) {
    var sinistra = Math.max(0, da) / scala * 100;
    var larghezza = Math.max(0, a - Math.max(0, da)) / scala * 100;
    return '<div class="riga' + (finale ? " estremo" : "") + '"><div class="nome"><b>' + nome +
      '</b></div><div class="pista"><span class="seg ' + classe + '" style="left:' + sinistra +
      "%;width:" + larghezza + '%"></span></div><div class="val ' + classe + '">' + testo + "</div></div>";
  }

  // 3. quattro barre per un conto: lordo, imposta, bollo, netto
  function blocco(titolo, lordo, bollo, netto, scala) {
    var imposta = lordo - nettoDopoImposta(lordo);
    return '<div class="blocco"><h3 style="font:800 .95rem var(--f-display);margin:14px 0 6px">' + titolo + '</h3><div class="cascata">' +
      riga("Interessi lordi", 0, lordo, scala, "su", eur.format(lordo)) +
      riga("Imposta interessi", lordo - imposta, lordo, scala, "giu", "−" + eur.format(imposta)) +
      riga("Bollo", lordo - imposta - bollo, lordo - imposta, scala, "giu", "−" + eur.format(bollo)) +
      riga("Netto", 0, netto, scala, "su", eur.format(netto), true) + "</div></div>";
  }

  // ciambella: come è divisa la giacenza tra CC e CD
  function torta(g, quotaCC) {
    var p = dividi ? quotaCC / g * 100 : 0;
    var svg = '<svg class="ciambella" viewBox="0 0 42 42" role="img" aria-label="' + (dividi ? "Suddivisione CC " + pct.format(p) + "%, CD " + pct.format(100 - p) + "%" : "Nessuna suddivisione") + '">' +
      '<circle class="' + (dividi ? "cd" : "pista") + '" cx="21" cy="21" r="15.9155"/>' +
      (dividi ? '<circle class="cc" cx="21" cy="21" r="15.9155" stroke-dasharray="' + p + " " + (100 - p) + '" stroke-dashoffset="25"/>' : "") +
      '<text x="21" y="' + (dividi ? 21.5 : 23) + '">' + (dividi ? Math.round(p) + "%" : "–") + "</text>" +
      (dividi ? '<text class="sub" x="21" y="26">nel CC</text>' : "") + "</svg>";
    var leg = dividi ?
      '<li><i style="background:var(--arancio)"></i><span>Conto corrente <b>' + eur.format(quotaCC) + "</b></span></li>" +
      '<li><i style="background:var(--ink-2)"></i><span>Conto deposito <b>' + eur.format(g - quotaCC) + "</b></span></li>" :
      "<li>Attiva la suddivisione per vederla.</li>";
    $("torta").hidden = !dividi;
    $("torta").parentNode.classList.toggle("senza", !dividi);
    $("torta").innerHTML = svg + '<ul class="leg-torta">' + leg + "</ul>";
  }

  // 4. ricalcolo tutto e ridisegno
  function aggiorna() {
    var v = leggi(), box = $("blocco-risultato");
    if (!v) {
      box.classList.add("inattivo");
      $("avviso").innerHTML = '<p class="avviso">Correggi i campi evidenziati: sotto resta l\'ultimo risultato valido.</p>';
      return;
    }
    box.classList.remove("inattivo");
    $("avviso").innerHTML = "";

    var g = v.giacenza, anni = v.anni;
    var durata = anni + (anni === 1 ? " anno" : " anni");
    var quotaCD = g - v.quotaCC;
    torta(g, v.quotaCC);

    // le tre strade: tutto CC, tutto CD, la suddivisione scelta dall'utente
    var lordoCC = interessiLordi(g, v.tassoCC, anni), bCC = bolloCC(g, anni), nCC = nettoCC(g, v.tassoCC, anni);
    var lordoCD = interessiLordi(g, v.tassoCD, anni), bCD = bolloCD(g, anni), nCD = nettoCD(g, v.tassoCD, anni);
    var lordoS = 0, bS = 0, nS = 0;
    if (dividi) {
      lordoS = interessiLordi(v.quotaCC, v.tassoCC, anni) + interessiLordi(quotaCD, v.tassoCD, anni);
      bS = bolloCC(v.quotaCC, anni) + bolloCD(quotaCD, anni);
      nS = nettoSplit(g, v.quotaCC, v.tassoCC, v.tassoCD, anni);
    }

    // e la suddivisione migliore
    var qMax = migliorSplit(g, v.tassoCC, v.tassoCD, anni);
    var nMax = nettoSplit(g, qMax, v.tassoCC, v.tassoCD, anni);
    var singolaMigliore = Math.max(nCC, nCD);
    var testoMax = qMax === 0 ? "Tutto nel CD" : qMax === g ? "Tutto nel CC" :
      eur.format(qMax) + " nel CC + " + eur.format(g - qMax) + " nel CD";

    $("vincitore").textContent = "Meglio: " + testoMax;
    var guadagno = nMax - singolaMigliore;
    $("delta").className = "delta " + (guadagno > 0.005 ? "su" : "");
    $("delta").textContent = guadagno > 0.005 ?
      "+" + eur.format(guadagno) + " rispetto alla miglior scelta singola, in " + durata :
      "Nessun vantaggio a dividere: la scelta singola è già la migliore (" + durata + ")";
    var bMax = bolloCC(qMax, anni) + bolloCD(g - qMax, anni);
    function dett(n, b) { return "Netto annuo " + pct.format(n / g / anni * 100) + "% · bollo " + eur.format(b); }
    var voci = [
      ["Tutto nel CC", nCC, false, "Tutta la giacenza nel conto corrente", dett(nCC, bCC)],
      ["Tutto nel CD", nCD, false, "Tutta la giacenza nel conto deposito", dett(nCD, bCD)],
      ["La tua suddivisione", nS, false, "CC " + eur.format(v.quotaCC) + " + CD " + eur.format(quotaCD), dett(nS, bS)],
      ["Suddivisione migliore", nMax, true, testoMax, dett(nMax, bMax)]
    ];
    if (!dividi) voci.splice(2, 1);
    $("opzioni").innerHTML = voci.map(function (x) {
      return '<li class="' + (x[2] ? "best" : "") + '"><span>' + x[0] + "</span><b>" + eur.format(x[1]) + "</b><small>" + x[3] + "<br>" + x[4] + "</small></li>";
    }).join("");
    $("rend").textContent = "Rendimento netto annuo della migliore: " + pct.format(nMax / g / anni * 100) + "%";
    $("usa-migliore").hidden = Math.abs(qMax - v.quotaCC) < 0.005;
    $("usa-migliore").dataset.quota = qMax;
    $("dividi").dataset.quota = qMax;
    $("aiuto-quota").textContent = "Il resto (" + eur.format(quotaCD) + ") va nel conto deposito.";
    $("sottotitolo-cascata").textContent = "Stessa scala per tutti i blocchi.";
    $("cascate").style.setProperty("--n", dividi ? 3 : 2);
    var scala = Math.max(lordoCC, lordoCD, lordoS, 1e-9);
    $("cascate").innerHTML = blocco("Tutto nel conto corrente", lordoCC, bCC, nCC, scala) +
      blocco("Tutto nel conto deposito", lordoCD, bCD, nCD, scala) +
      (dividi ? blocco("Suddivisione mista", lordoS, bS, nS, scala) : "");
    $("mob-p").textContent = testoMax;
    $("mob-delta").textContent = $("delta").textContent;

    try {
      var p = new URLSearchParams();
      Object.keys(v).forEach(function (k) { if (k !== "quotaCC" || dividi) p.set(k, v[k]); });
      history.replaceState(null, "", "#" + p);
    } catch (e) {}
  }

  function imposta(o) {
    if ("quotaCC" in o && !dividi) delete o.quotaCC;
    Object.keys(o).forEach(function (k) { $(k).value = o[k]; });
    aggiorna();
  }

  // 5. eventi
  $("profilo").addEventListener("input", function () { if (uguali) $("tassoCD").value = $("tassoCC").value; aggiorna(); });
  $("diversi").addEventListener("click", function () { uguali = !uguali; mostraTassi(); aggiorna(); });
  $("profilo").addEventListener("submit", function (e) { e.preventDefault(); });
  document.querySelectorAll("[data-esempio]").forEach(function (b) {
    b.addEventListener("click", function () { var g = PRESET[b.dataset.esempio]; imposta({giacenza: g, quotaCC: Math.min(LIMITE_GIACENZA, g)}); });
  });
  $("dividi").addEventListener("click", function () {
    dividi = !dividi; mostraDividi();
    if (dividi) $("quotaCC").value = this.dataset.quota || 0;   // parte dalla migliore, poi si modifica
    aggiorna();
  });
  $("usa-migliore").addEventListener("click", function () { imposta({quotaCC: Number(this.dataset.quota)}); });
  $("ripristina").addEventListener("click", function () {
    var o = {};
    dividi = false; mostraDividi();
    uguali = true; mostraTassi();
    Object.keys(CAMPI).forEach(function (k) { o[k] = CAMPI[k][0]; });
    imposta(o);
  });
  // all'apertura: valori dal link, se ci sono
  try { new URLSearchParams(location.hash.slice(1)).forEach(function (val, k) { if (CAMPI[k]) $(k).value = val; if (k === "quotaCC") dividi = true; });
  mostraDividi();
  uguali = $("tassoCC").value === $("tassoCD").value;
  mostraTassi(); } catch (e) {}
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (voci) {
      $("barra-mobile").classList.toggle("visibile", !voci[0].isIntersecting && voci[0].boundingClientRect.top > 0);
    }).observe($("risultato"));
  }
  aggiorna();
})();
