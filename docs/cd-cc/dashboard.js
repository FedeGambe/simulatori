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

  function mostraDividi() { $("sudd").open = dividi; }   // sezione aperta = suddivisione attiva

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

  // grafico del punto di pareggio: vantaggio del CD sul CC (tutta la giacenza in un conto) al variare dell'importo
  function pareggio(v) {
    var el = $("pareggio"), W = Math.max(280, el.clientWidth || 800), H = W < 560 ? 230 : 280;
    var diff = function (x) { return nettoCD(x, v.tassoCD, v.anni) - nettoCC(x, v.tassoCC, v.anni); };
    // punti di pareggio: cambi di segno, cercati a passi di 1 € fino a un massimo ampio
    function trova(max) {
      var out = [], passo = Math.max(1, Math.round(max / 4000)), a = 1, da = diff(1);
      for (var x = passo; x <= max; x += passo) {
        var dx = diff(x);
        if ((da > 0) !== (dx > 0) && Math.abs(dx - da) > 1e-9) {
          // salto del bollo fisso: il pareggio è la soglia; altrimenti interpolo
          var r = a < LIMITE_GIACENZA + 1 && x >= LIMITE_GIACENZA ? LIMITE_GIACENZA : a + (x - a) * (0 - da) / (dx - da);
          out.push(r);
        }
        a = x; da = dx;
      }
      return out;
    }
    var lontani = trova(1e6);
    var arrotonda = function (x) { var e = Math.pow(10, Math.floor(Math.log10(x))); return Math.ceil(x / e * 2) / 2 * e; };
    // scala: centrata sui punti di pareggio; la tua giacenza entra solo se non li schiaccia (altrimenti freccia a destra)
    var ultimaSoglia = lontani.length ? lontani[lontani.length - 1] : 0;
    var base = Math.max(ultimaSoglia * 2, 20000);
    var xMax = arrotonda(v.giacenza * 1.25 <= base * 4 || !lontani.length ? Math.max(base, v.giacenza * 1.25) : base);
    var dentro = v.giacenza <= xMax;
    var soglie = lontani.filter(function (x) { return x < xMax; });

    var n = 300, punti = [];
    for (var i = 0; i <= n; i++) punti.push(i / n * xMax);
    punti.push(LIMITE_GIACENZA, LIMITE_GIACENZA + 0.01);   // il salto del bollo a 5.000 €
    punti = punti.filter(function (x) { return x <= xMax; }).sort(function (a, b) { return a - b; });
    var ys = punti.map(diff);
    var extra = dentro ? [diff(v.giacenza)] : [];
    var yMax = Math.max.apply(null, ys.concat(extra, 1)), yMin = Math.min.apply(null, ys.concat(extra, -1));
    var pad = (yMax - yMin) * 0.12; yMax += pad; yMin -= pad;

    var righe = [], ultimo = -1e9;
    soglie.forEach(function (x) {
      var px = 54 + x / xMax * (W - 68);
      var su = px - ultimo < 80 && righe[righe.length - 1] === 0 ? 1 : 0;
      righe.push(su); if (!su) ultimo = px;
    });
    var m = {s: 54, d: 14, a: righe.indexOf(1) >= 0 ? 44 : 26, b: 34}, w = W - m.s - m.d, h = H - m.a - m.b;
    var X = function (x) { return m.s + x / xMax * w; }, Y = function (y) { return m.a + (yMax - y) / (yMax - yMin) * h; };
    var y0 = Y(0), euro0 = new Intl.NumberFormat("it-IT", {maximumFractionDigits: 0, useGrouping: "always"});
    var corto = function (x) { return euro0.format(x); };

    var linea = punti.map(function (x, i) { return (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(ys[i]).toFixed(1); }).join("");
    var area = linea + "L" + X(xMax) + " " + y0 + "L" + X(0) + " " + y0 + "Z";
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Vantaggio del conto deposito sul conto corrente al variare della giacenza">' +
      '<defs><clipPath id="sopra"><rect x="0" y="0" width="' + W + '" height="' + y0 + '"/></clipPath>' +
      '<clipPath id="sotto"><rect x="0" y="' + y0 + '" width="' + W + '" height="' + (H - y0) + '"/></clipPath></defs>' +
      '<path class="area-cd" clip-path="url(#sopra)" d="' + area + '"/><path class="area-cc" clip-path="url(#sotto)" d="' + area + '"/>';
    // assi: tacche sull'importo, etichette sul vantaggio
    // tacche a passi tondi (1, 2, 5 × 10^k), distanziate quanto basta per l'etichetta più lunga
    var largEt = (euro0.format(xMax).length + 2) * 7 + 18;
    var grezzo = xMax / Math.max(2, Math.floor(w / largEt)), e10 = Math.pow(10, Math.floor(Math.log10(grezzo)));
    var passoX = [1, 2, 5, 10].map(function (k) { return k * e10; }).filter(function (k) { return k >= grezzo; })[0];
    for (var xt = 0; xt <= xMax + 1e-6; xt += passoX) {
      svg += '<line class="asse" x1="' + X(xt) + '" x2="' + X(xt) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b + 5) + '"/>' +
        '<text x="' + X(xt) + '" y="' + (H - m.b + 18) + '" text-anchor="' + (xt === 0 ? "start" : X(xt) > W - m.d - largEt / 2 ? "end" : "middle") + '">' + corto(xt) + " €</text>";
    }
    svg += '<line class="asse" x1="' + m.s + '" x2="' + (W - m.d) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '"/>' +
      '<line class="zero" x1="' + m.s + '" x2="' + (W - m.d) + '" y1="' + y0 + '" y2="' + y0 + '"/>' +
      '<text x="' + (m.s - 8) + '" y="' + (y0 + 4) + '" text-anchor="end">0 €</text>' +
      (y0 - Y(yMax) > 22 ? '<text x="' + (m.s - 8) + '" y="' + (Y(yMax) + 10) + '" text-anchor="end">+' + euro0.format(yMax) + " €</text>" : "") +
      (Y(yMin) - y0 > 22 ? '<text x="' + (m.s - 8) + '" y="' + (Y(yMin) - 2) + '" text-anchor="end">−' + euro0.format(-yMin) + " €</text>" : "");
    svg += '<path class="linea" d="' + linea + '"/>';
    // zone: dove conviene l'uno o l'altro, scritte al centro se c'è spazio
    var bordi = [0].concat(soglie, xMax), zone = [];
    for (var z = 0; z < bordi.length - 1; z++) {
      var meta = (bordi[z] + bordi[z + 1]) / 2, cd = diff(Math.max(meta, 1)) > 0;
      zone.push({da: bordi[z], a: bordi[z + 1], cd: cd});
      if (W >= 560 && X(bordi[z + 1]) - X(bordi[z]) > 90)   // su telefono bastano le etichette sotto
        svg += '<text class="zona" x="' + X(meta) + '" y="' + (cd ? m.a + 12 : H - m.b - 8) + '" text-anchor="middle">Conviene il ' + (cd ? "CD" : "CC") + "</text>";
    }
    // punti di pareggio
    soglie.forEach(function (x, i) {
      var anc = X(x) < m.s + 30 ? "start" : X(x) > W - m.d - 30 ? "end" : "middle";
      svg += '<line class="soglia" x1="' + X(x) + '" x2="' + X(x) + '" y1="' + (m.a - (righe[i] ? 18 : 0)) + '" y2="' + (H - m.b) + '"/>' +
        '<text class="forte" x="' + X(x) + '" y="' + (m.a - 8 - righe[i] * 18) + '" text-anchor="' + anc + '">' + euro0.format(x) + " €</text>";
    });
    // la tua giacenza
    var dt = diff(v.giacenza), segnoTu = (dt >= 0 ? "CD +" : "CC +") + eur.format(Math.abs(dt));
    if (dentro) {
      svg += '<line class="tu" x1="' + X(v.giacenza) + '" x2="' + X(v.giacenza) + '" y1="' + Y(dt) + '" y2="' + y0 + '"/>' +
        '<circle class="punto-tu" cx="' + X(v.giacenza) + '" cy="' + Y(dt) + '" r="5"/>' +
        '<text class="rosso" x="' + (X(v.giacenza) + (X(v.giacenza) > W - 140 ? -9 : 9)) + '" y="' + (Y(dt) + (dt >= 0 ? -8 : 16)) + '" text-anchor="' + (X(v.giacenza) > W - 140 ? "end" : "start") + '">Tu: ' +
        segnoTu + "</text>";
    }
    // hover: un punto segue la linea e dice importo e vantaggio
    svg += '<g class="hover" visibility="hidden"><line class="h-linea" y1="' + m.a + '" y2="' + (H - m.b) + '"/><circle class="h-punto" r="5"/>' +
      '<rect class="h-fondo" rx="6" height="24"/><text class="h-testo"></text></g>' +
      '<rect class="h-area" x="' + m.s + '" y="' + m.a + '" width="' + w + '" height="' + h + '" fill="transparent"/>';
    el.innerHTML = svg + "</svg>";
    var svgEl = el.firstChild, g = svgEl.querySelector(".hover"), testo = g.querySelector(".h-testo"), fondo = g.querySelector(".h-fondo");
    var tondo = Math.pow(10, Math.max(0, Math.floor(Math.log10(xMax)) - 2));   // arrotondo l'importo a cifre leggibili
    function muovi(e) {
      var r = svgEl.getBoundingClientRect(), sx = (e.clientX - r.left) * W / r.width;
      var xv = Math.round(Math.min(xMax, Math.max(0, (sx - m.s) / w * xMax)) / tondo) * tondo, d = diff(Math.max(xv, 1));
      var px = X(xv), py = Y(d);
      g.setAttribute("visibility", "visible");
      g.querySelector(".h-linea").setAttribute("x1", px); g.querySelector(".h-linea").setAttribute("x2", px);
      g.querySelector(".h-punto").setAttribute("cx", px); g.querySelector(".h-punto").setAttribute("cy", py);
      testo.textContent = euro0.format(xv) + " € · " + (d >= 0 ? "CD +" : "CC +") + eur.format(Math.abs(d));
      var tw = testo.getComputedTextLength() + 16, tx = Math.min(W - m.d - tw, Math.max(m.s, px - tw / 2));
      var ty = py - 36 < m.a - 20 ? py + 12 : py - 36;
      fondo.setAttribute("x", tx); fondo.setAttribute("y", ty); fondo.setAttribute("width", tw);
      testo.setAttribute("x", tx + 8); testo.setAttribute("y", ty + 16);
    }
    svgEl.addEventListener("pointermove", muovi);
    svgEl.addEventListener("pointerdown", muovi);
    svgEl.addEventListener("pointerleave", function () { g.setAttribute("visibility", "hidden"); });
    $("zone").innerHTML = zone.map(function (q, i) {
      var dove = i === 0 ? "fino a " + euro0.format(q.a) + " €" : i === zone.length - 1 ? "oltre " + euro0.format(q.da) + " €" : "da " + euro0.format(q.da) + " a " + euro0.format(q.a) + " €";
      if (i === zone.length - 1 && zone.length === 1) dove = "a ogni importo";
      return '<span class="' + (q.cd ? "cd" : "cc") + '"><b>' + (q.cd ? "CD" : "CC") + "</b> " + dove + "</span>";
    }).join("") + (dentro ? "" : '<span class="tu">Tu, ' + euro0.format(v.giacenza) + " € (fuori scala): <b>" + segnoTu + "</b></span>");
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
    // se la migliore è tutto in un conto, evidenzio quella voce invece di ripeterla
    if (qMax === g || qMax === 0) {
      var sola = voci[qMax === g ? 0 : 1];
      sola[0] += " · la migliore"; sola[2] = true;
      voci.pop();
    }
    if (!dividi) voci.splice(2, 1);
    // con la suddivisione migliore in vista, "Tutto nel CC/CD" si compattano: solo netto e rendimento %
    var compatte = qMax !== g && qMax !== 0;
    $("opzioni").innerHTML = voci.map(function (x, i) {
      if (compatte && i < 2)
        return '<li class="compatta"><span>' + x[0] + "</span><b>" + eur.format(x[1]) +
          "<em>" + pct.format(x[1] / g / anni * 100) + "%</em></b></li>";
      return '<li class="' + (x[2] ? "best" : "") + '"><span>' + x[0] + "</span><b>" + eur.format(x[1]) + "</b><small>" + x[3] + "<br>" + x[4] + "</small></li>";
    }).join("");
    $("rend").textContent = "Rendimento netto annuo della migliore: " + pct.format(nMax / g / anni * 100) + "%";
    $("usa-migliore").hidden = Math.abs(qMax - v.quotaCC) < 0.005;
    $("usa-migliore").dataset.quota = qMax;
    $("sudd").dataset.quota = qMax;
    $("aiuto-quota").textContent = "Il resto (" + eur.format(quotaCD) + ") va nel conto deposito.";
    $("sottotitolo-cascata").textContent = "Stessa scala per tutti i blocchi.";
    $("cascate").style.setProperty("--n", dividi ? 3 : 2);
    var scala = Math.max(lordoCC, lordoCD, lordoS, 1e-9);
    $("cascate").innerHTML = blocco("Tutto nel conto corrente", lordoCC, bCC, nCC, scala) +
      blocco("Tutto nel conto deposito", lordoCD, bCD, nCD, scala) +
      (dividi ? blocco("Suddivisione mista", lordoS, bS, nS, scala) : "");
    pareggio(v);
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
  $("sudd").addEventListener("toggle", function () {
    if (this.open === dividi) return;
    dividi = this.open;
    if (dividi) $("quotaCC").value = this.dataset.quota || 0;   // parte dalla migliore, poi si modifica
    aggiorna();
  });
  var ultimaLarghezza = 0;
  addEventListener("resize", function () {
    var w = $("pareggio").clientWidth;
    if (w !== ultimaLarghezza) { ultimaLarghezza = w; aggiorna(); }
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
