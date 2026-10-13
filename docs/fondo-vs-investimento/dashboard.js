// INTERFACCIA: legge le caselle e i cursori, usa Confronto (script.js), scrive nella pagina.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var eur = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always"});
  var eur2 = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR", useGrouping: "always"});
  var pct = new Intl.NumberFormat("it-IT", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  var num = new Intl.NumberFormat("it-IT");

  // id: [predefinito, minimo, massimo, nome per l'errore]
  var CAMPI = {
    eta: [35, 16, 70, "Età"],
    pens: [67, 40, 80, "Età di pensionamento"],
    ral: [30000, 1000, 1e6, "RAL"],
    acc: [250, 0, 10000, "Importo mensile"],
    bil: [50, 0, 100, "Quota nel fondo"],
    dat: [2, 0, 15, "Contributo del datore"],
    rgf: [5, -5, 15, "Rendimento del fondo"],
    ctf: [1, 0, 5, "Costi del fondo"],
    tsf: [25, 0, 100, "Quota in titoli di Stato del fondo"],
    rgl: [5, -5, 15, "Rendimento dell'investimento"],
    ctl: [0.25, 0, 5, "Costi dell'investimento"],
    tsl: [25, 0, 100, "Quota in titoli di Stato dell'investimento"],
    inf: [0, 0, 10, "Adeguamento all'inflazione"],
    cr: [2, -2, 10, "Crescita della retribuzione"]
  };
  var PROFILO = "bilanciato", COMUNE_PREDEFINITO = "F257";
  var ultimo = null;       // ultimo risultato valido {r, p, curva, quota}, per ridisegnare i grafici se cambia la larghezza
  var W = 800, limite = 0, accUnita = "e";   // accUnita: l'importo è scritto in € al mese ("e") o in % della RAL ("p")
  var toccato = false;     // false: il cursore segue la suddivisione migliore; true: l'ha scelta chi usa la pagina

  function imposta(id, val) {
    $(id).value = val;
    if ($(id + "-r")) $(id + "-r").value = val;
  }

  // 1. leggo e controllo i valori; se uno è sbagliato mostro l'errore e restituisco null
  function leggi() {
    var v = {}, ok = true;
    Object.keys(CAMPI).forEach(function (id) {
      var c = CAMPI[id], el = $(id), err = $(id + "-e");
      var n = parseFloat(String(el.value).replace(",", "."));
      var bad = isNaN(n) || n < c[1] || n > c[2];
      el.setAttribute("aria-invalid", bad);
      err.hidden = !bad;
      err.textContent = bad ? c[3] + ": inserisci un valore tra " + num.format(c[1]) + " e " + num.format(c[2]) + "." : "";
      if (bad) { ok = false; if (el.closest("details")) el.closest("details").open = true; } else v[id] = n;
    });
    if (ok && v.pens <= v.eta) {
      $("pens").setAttribute("aria-invalid", true);
      $("pens-e").hidden = false;
      $("pens-e").textContent = "L'età di pensionamento deve essere maggiore dell'età di oggi.";
      ok = false;
    }
    if (ok && accUnita === "p" && v.acc > 100) {
      $("acc").setAttribute("aria-invalid", true);
      $("acc-e").hidden = false;
      $("acc-e").textContent = "Importo mensile: in percentuale inserisci un valore tra 0 e 100.";
      ok = false;
    }
    if (ok) v.accM = accUnita === "p" ? v.ral * v.acc / 1200 : v.acc;
    v.comune = COMUNE_PREDEFINITO;   // comune fisso: pesa poco (solo l'addizionale comunale sull'IRPEF recuperata)
    return ok ? v : null;
  }
  function parametri(v) {
    var anno = v.accM * 12;   // importo mensile messo da parte, diviso tra fondo e fuori dal fondo con il cursore
    return {eta: v.eta, pensione: v.pens, ral: v.ral, comune: v.comune, versaFondo: anno * v.bil / 100, datore: v.dat, versaLibero: anno * (1 - v.bil / 100),
      rendFondo: v.rgf, costiFondo: v.ctf, statoFondo: v.tsf, rendLibero: v.rgl, costiLibero: v.ctl, statoLibero: v.tsl, inflazione: v.inf, crescita: v.cr};
  }

  // 2. utilità dei grafici
  function passo(max) {
    var grezzo = max / 4, p = Math.pow(10, Math.floor(Math.log10(grezzo))), f = grezzo / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function breve(v) {
    return v >= 1e6 ? pct.format(v / 1e6) + " mln" : v >= 1000 ? num.format(Math.round(v / 1000)) + " mila" : String(Math.round(v));
  }
  function voce(x) {
    return '<li class="' + (x[3] || "") + '"><span>' + x[0] + "</span><b>" + x[1] + "</b><small>" + x[2] + "</small></li>";
  }
  var L = 64, R = 16, T = 14, B = 34;
  function assi(W, H, cima, s, etichettaX) {
    var html = "";
    for (var y = 0; y <= cima + 1; y += s) {
      var Y = T + (1 - y / cima) * (H - T - B);
      html += '<line class="asse" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y + '" y2="' + Y + '"/><text x="' + (L - 8) + '" y="' + (Y + 4) + '" text-anchor="end">' + breve(y) + "</text>";
    }
    return html + etichettaX;
  }

  // 3. verdetto: per ogni 100 € di costo, fondo contro investimento libero
  // un riquadro con una suddivisione: importi nel fondo e fuori, netto finale, rendimento ogni 100 € di costo
  function comb(titolo, w, i, x, classe) {
    return '<div class="tua ' + classe + '"><p class="etic">' + titolo + "</p>" +
      '<ul class="quote">' + [["f", "Nel fondo", w], ["l", "Fuori dal fondo", i]].map(function (q) {
        return '<li class="' + q[0] + '"><span>' + q[1] + '</span><span class="imp"><b class="num">' + Math.round(w + i > 0 ? q[2] / (w + i) * 100 : 0) + "%</b></span></li>";
      }).join("") + "</ul>" +
      '<div class="riga-netto"><p class="kpi num">' + eur.format(x.netto) + '</p><p class="kpi-sub">netto a ' + $("pens").value + " anni (" + eur.format(x.nettoReale) + " di oggi)</p></div>" +
      '<p class="kpi-mesi">Ti costa di tasca ' + eur.format(x.costo) + " in tutto: ogni 100 € diventano " + eur.format(x.perCento) + ".</p></div>";
  }
  function verdetto(r, p, migliore) {
    var f = r.parteFondo, l = r.parteLibero;
    var dp = r.tuttoFondo.perCento - r.tuttoLibero.perCento;   // per il verdetto sotto la barra mobile: le due strade pure
    var pariPure = Math.abs(dp) < Math.max(r.tuttoFondo.perCento, r.tuttoLibero.perCento) * 0.02;
    var dat = Confronto.datoreDi(p, p.versaFondo) > 0 ? p.ral * p.datore / 100 : 0;   // contributo del datore l'anno, solo se nel fondo metti almeno il minimo
    var base = p.versaFondo + p.versaLibero + dat, quota = function (x) { return (base > 0 ? x / base * 100 : 0).toFixed(1) + "%"; };
    var riga = function (nome, x, classe, anno, extra) {
      return '<div class="cf-riga"><span class="cf-nome">' + nome + '</span><span class="cf-pista"><i class="' + classe + '" style="width:' + quota(anno) + '"></i>' +
        (extra ? '<i class="d" style="width:' + quota(extra) + '"></i>' : "") + '</span>' +
        '<b class="cf-val num">' + eur.format(anno / 12) + " al mese<small>(" + eur.format(anno) + " all'anno)</small>" + (extra ? "<small>+ " + eur.format(extra / 12) + " al mese del datore</small>" : "") + "</b></div>";
    };
    var pareggio = r.pareggio === null ? "Investendo tutto fuori dal fondo non si arriva alla pari con il fondo nemmeno con rendimenti fuori scala." :
      "Investendo tutto fuori dal fondo si pareggia con tutto nel fondo solo se l'investimento rende il <b>" + pct.format(r.pareggio) + "%</b> lordo l'anno (tu hai ipotizzato " + pct.format(p.rendLibero) + "%, il fondo " + pct.format(p.rendFondo) + "%).";
    $("blocco-risultato").innerHTML =
      '<p class="sottotitolo">Mettendo da parte ' + eur.format((p.versaFondo + p.versaLibero) / 12) + " al mese (" + eur.format(p.versaFondo + p.versaLibero) + " l'anno), così divisi (importo mensile di ciascuna parte, con quanto diventa netto dopo le tasse; il tratteggio è il contributo del datore):</p>" +
      '<div class="col-barre"><div class="confr">' + riga("Nel fondo", f, "f", p.versaFondo, dat) + riga("Fuori dal fondo", l, "l", p.versaLibero, 0) + "</div>" +
      '<p class="confronto">' + pareggio + "</p></div>" +
      '<div class="combinazioni">' + comb("Suddivisione migliore", migliore.w, migliore.i, migliore, "migliore") + (toccato ? comb("La tua combinazione", p.versaFondo, p.versaLibero, r, "") : "") + "</div>";
    $("mob-p").textContent = eur.format(r.netto);
    $("mob-delta").textContent = pariPure ? "fondo e libero pari" : dp > 0 ? "conviene il fondo" : "conviene il libero";
  }

  // 4. bilanciamento: lo stesso importo mensile diviso tra fondo e libero
  function graficoBilanciamento(r, p, curva, quota) {
    var el = $("grafico-bil"), H;
    W = Math.max(300, el.clientWidth || 800); H = Math.round(Math.max(220, W * 0.36));
    var hi = Math.max.apply(null, curva.map(function (c) { return c.netto; }).concat([r.netto]));
    var s = passo(hi), cima = Math.ceil(hi / s) * s;
    var X = function (q) { return L + q * (W - L - R); };
    var Y = function (v) { return T + (1 - v / cima) * (H - T - B); };
    var migliore = curva.reduce(function (a, c) { return c.netto > a.netto ? c : a; });
    var xs = "";
    for (var q = 0; q <= 1.001; q += 0.25) xs += '<text x="' + X(q) + '" y="' + (H - 12) + '" text-anchor="middle">' + Math.round(q * 100) + "%</text>";
    var punti = curva.map(function (c) { return X(c.quota).toFixed(1) + "," + Y(c.netto).toFixed(1); });
    var area = "M" + X(0) + "," + Y(0) + "L" + punti.join("L") + "L" + X(1) + "," + Y(0) + "Z";
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Netto finale al variare della quota messa nel fondo">' +
      assi(W, H, cima, s, xs) +
      '<defs><clipPath id="cp-f"><rect x="0" y="0" width="' + X(quota) + '" height="' + H + '"/></clipPath><clipPath id="cp-l"><rect x="' + X(quota) + '" y="0" width="' + W + '" height="' + H + '"/></clipPath></defs>' +
      '<path d="' + area + '" fill="var(--teal)" opacity=".3" clip-path="url(#cp-f)"/><path d="' + area + '" fill="var(--libero)" opacity=".3" clip-path="url(#cp-l)"/>' +
      '<line x1="' + X(quota) + '" x2="' + X(quota) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="4 3"/>' +
      '<polyline points="' + punti.join(" ") + '" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>' +
      '<line id="bl-l" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink-3)" stroke-width="1" style="display:none"/>' +
      '<circle id="bl-p" r="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2" style="display:none"/>' +
      '<circle cx="' + X(migliore.quota) + '" cy="' + Y(migliore.netto) + '" r="6" fill="var(--verde)" stroke="var(--ink)" stroke-width="2"/>' +
      '<circle cx="' + X(quota) + '" cy="' + Y(r.netto) + '" r="8" fill="var(--teal)" stroke="var(--ink)" stroke-width="3"/>' +
      '<text x="' + (W - R) + '" y="' + (H - 1) + '" text-anchor="end">quota messa nel fondo</text></svg>';
    $("legenda-bil").innerHTML = '<span><i style="background:var(--teal)"></i>La tua scelta</span><span><i style="background:var(--teal);opacity:.4"></i>Parte nel fondo</span><span><i style="background:var(--libero)"></i>Parte fuori dal fondo</span><span><i style="background:var(--verde)"></i>Il massimo</span>';
    var info = function (c) {
      return "<b>" + eur.format(c.w) + " l'anno nel fondo</b> e " + eur.format(c.i) + " fuori · netto " + eur.format(c.netto) + " · ogni 100 € di costo " + eur.format(c.perCento);
    };
    var tua = {quota: quota, w: p.versaFondo, i: p.versaLibero, netto: r.netto, perCento: r.perCento};
    var svg = el.firstChild, bl = $("bl-l"), bp = $("bl-p");
    function vicino(e) {
      var rect = svg.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * W;
      return curva[Math.max(0, Math.min(curva.length - 1, Math.round((x - L) / (W - L - R) * (curva.length - 1))))];
    }
    svg.addEventListener("pointermove", function (e) {
      var c = vicino(e);
      bl.style.display = ""; bl.setAttribute("x1", X(c.quota)); bl.setAttribute("x2", X(c.quota));
      bp.style.display = ""; bp.setAttribute("cx", X(c.quota)); bp.setAttribute("cy", Y(c.netto));
      $("bil-info").innerHTML = info(c) + " · <i>clic per scegliere</i>";
    });
    svg.addEventListener("pointerleave", function () { bl.style.display = bp.style.display = "none"; $("bil-info").innerHTML = "<b>La tua scelta:</b> " + info(tua).replace(/^<b>/, "").replace("</b>", ""); });
    svg.addEventListener("click", function (e) { impostaQuota(vicino(e).quota); });
    $("bil-info").innerHTML = "<b>La tua scelta:</b> " + info(tua).replace(/^<b>/, "").replace("</b>", "");
    var tutto = curva[curva.length - 1], niente = curva[0];
    $("opzioni-bil").innerHTML = [
      ["Tutto nel fondo", eur.format(tutto.netto), eur.format(tutto.w / 12) + " al mese nel fondo · ogni 100 € di costo " + eur.format(tutto.perCento), migliore === tutto ? "best" : ""],
      ["La tua scelta", eur.format(r.netto), eur.format(p.versaFondo) + " l'anno nel fondo · ogni 100 € di costo " + eur.format(r.perCento), ""],
      ["Tutto fuori dal fondo", eur.format(niente.netto), eur.format(niente.i / 12) + " al mese investiti · ogni 100 € di costo " + eur.format(niente.perCento), migliore === niente ? "best" : ""]
    ].map(voce).join("");
    $("nota-bil").textContent = migliore.quota > 0 && migliore.quota < 1 ? "Il massimo è con " + eur.format(migliore.w) + " l'anno nel fondo e " + eur.format(migliore.i) + " fuori." :
      migliore.quota === 1 ? "Con questi dati il massimo è mettere tutto nel fondo." : "Con questi dati il massimo è investire tutto fuori dal fondo.";
  }

  // 5. crescita nel tempo
  function graficoCrescita(r, p) {
    var el = $("grafico"), H;
    W = Math.max(300, el.clientWidth || 800); H = Math.round(Math.max(230, W * 0.42));
    var pt = r.punti, n = r.anni, e0 = pt[0].eta, tf = r.tuttoFondo.punti, tl = r.tuttoLibero.punti;
    var hi = 1;
    pt.forEach(function (q, k) { hi = Math.max(hi, q.totale, q.costo, tf[k].netto, tl[k].netto); });
    var s = passo(hi), cima = Math.ceil(hi / s) * s;
    var X = function (eta) { return L + (eta - e0) / n * (W - L - R); };
    var Y = function (v) { return T + (1 - v / cima) * (H - T - B); };
    var linea = function (f) { return pt.map(function (q, k) { return X(q.eta).toFixed(1) + "," + Y(f(q, k)).toFixed(1); }); };
    var salto = n > 40 ? 10 : n > 15 ? 5 : n > 6 ? 2 : 1, xs = "";
    for (var a = Math.ceil(e0 / salto) * salto; a <= e0 + n; a += salto) xs += '<text x="' + X(a) + '" y="' + (H - 12) + '" text-anchor="middle">' + a + "</text>";
    var area = function (sopra, sotto, colore, op) {
      return '<path d="M' + linea(sopra).join("L") + "L" + linea(sotto).reverse().join("L") + 'Z" fill="' + colore + '" opacity="' + op + '"/>';
    };
    var tratto = function (f, colore, sp, dash) {
      return '<polyline points="' + linea(f).join(" ") + '" fill="none" stroke="' + colore + '" stroke-width="' + sp + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : "") + ' stroke-linejoin="round"/>';
    };
    el.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Valore netto anno per anno: tua combinazione, tutto nel fondo, tutto fuori dal fondo, costo di tasca">' +
      assi(W, H, cima, s, xs) +
      area(function (q) { return q.fondo; }, function () { return 0; }, "var(--teal)", ".5") +
      area(function (q) { return q.totale; }, function (q) { return q.fondo; }, "var(--libero)", ".5") +
      tratto(function (q) { return q.costo; }, "var(--rosso)", 2.5, "2 5") +
      tratto(function (q, k) { return tf[k].netto; }, "var(--teal-ink)", 2.5, "7 5") +
      tratto(function (q, k) { return tl[k].netto; }, "var(--libero-ink)", 2.5, "7 5") +
      tratto(function (q) { return q.totale; }, "var(--ink)", 3.5) +
      '<line id="cr-l" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink)" stroke-width="1"/><circle id="cr-m" r="5" fill="var(--ink)" stroke="var(--bg)" stroke-width="2"/>' +
      '<text x="' + (W - R) + '" y="' + (H - 1) + '" text-anchor="end">età</text></svg>';
    $("legenda-grafico").innerHTML = '<span><i style="background:var(--teal);opacity:.6"></i>Parte nel fondo</span><span><i style="background:var(--libero);opacity:.6"></i>Parte investita fuori</span>' +
      '<span><i style="background:var(--ink);height:4px;vertical-align:3px"></i>Totale della tua scelta</span>' +
      '<span><i style="background:var(--teal-ink);height:3px;vertical-align:3px"></i>Se tutto nel fondo</span><span><i style="background:var(--libero-ink);height:3px;vertical-align:3px"></i>Se tutto fuori</span>' +
      '<span><i style="background:var(--rosso);height:3px;vertical-align:3px"></i>Quanto ti è uscito di tasca</span>';
    var svg = el.firstChild;
    function punta(k) {
      var q = pt[k];
      $("cr-l").setAttribute("x1", X(q.eta)); $("cr-l").setAttribute("x2", X(q.eta));
      $("cr-m").setAttribute("cx", X(q.eta)); $("cr-m").setAttribute("cy", Y(q.totale));
      $("grafico-info").innerHTML = "<b>A " + q.eta + " anni</b> · tua scelta " + eur.format(q.totale) + " (fondo " + eur.format(q.fondo) + ", fuori " + eur.format(q.libero) + ") · tutto nel fondo " + eur.format(tf[k].netto) +
        " · tutto fuori " + eur.format(tl[k].netto) + " · ti è uscito di tasca " + eur.format(q.costo);
    }
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * W;
      punta(Math.max(0, Math.min(n, Math.round((x - L) / (W - L - R) * n))));
    });
    svg.addEventListener("pointerleave", function () { punta(n); });
    punta(n);
  }

  // 6. da dove arriva il netto: le tre colonne
  function tabella(r, p) {
    var cols = [["Tutto nel fondo", r.tuttoFondo], ["Tutto fuori", r.tuttoLibero], ["La tua scelta", r.tuo]];
    var scala = (document.querySelector("input[name=scala-tab]:checked") || {}).value || "t";
    var div = scala === "m" ? r.anni * 12 : scala === "a" ? r.anni : 1;   // il conto di tutto il periodo, diviso per anni o mesi
    var m = function (x) { return eur.format(x / div); };
    var righe = [
      ["Versi " + (scala === "m" ? "al mese" : scala === "a" ? "all'anno" : "in tutto"), function (x) { return m(x.versato); }],
      ["− IRPEF recuperata", function (x) { return x.irpef > 0 ? "−" + m(x.irpef) : "–"; }, "pos"],
      ["= Ti costa di tasca", function (x) { return m(x.costo); }, "tot"],
      ["+ Contributo del datore", function (x) { return x.datore > 0 ? "+" + m(x.datore) : "–"; }, "pos"],
      ["+ IRPEF reinvestita fuori", function (x) { return x.irpef > 0 ? "+" + m(x.irpef) : "–"; }, "pos"],
      ["+ Rendimenti netti", function (x) { return (x.rendimenti >= 0 ? "+" : "−") + m(Math.abs(x.rendimenti)); }, "pos"],
      ["− Imposta finale", function (x) { return x.imposta > 0 ? "−" + m(x.imposta) : "–"; }, "neg"],
      ["= Netto finale", function (x) { return m(x.netto); }, "tot"],
      ["Pari a, in euro di oggi", function (x) { return m(x.nettoReale); }],
      ["Ogni 100 € di costo", function (x) { return eur.format(x.perCento); }, "tot"]
    ];
    if (scala !== "t") righe = righe.slice(0, 5);   // rendimenti, imposta e netto hanno senso solo su tutto il periodo: al mese e all'anno restano i flussi
    $("tabella").innerHTML = '<div class="scorri"><table class="tabella"><thead><tr><th></th>' + cols.map(function (c) { return "<th>" + c[0] + "</th>"; }).join("") + "</tr></thead><tbody>" +
      righe.map(function (x) {
        return '<tr class="' + (x[2] === "tot" ? "tot" : "") + '"><td>' + x[0] + "</td>" + cols.map(function (c) { return '<td class="' + (x[2] === "pos" || x[2] === "neg" ? x[2] : "") + '">' + x[1](c[1]) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
    $("nota-tabella").textContent = "Le prime due colonne mettono da parte lo stesso importo (" + eur.format((p.versaFondo + p.versaLibero) / 12) + " al mese): nel fondo ti costa meno di tasca per l'IRPEF recuperata, che qui viene reinvestita fuori dal fondo; per questo l'ultima riga rapporta il netto al costo. Il fondo ha in più il contributo del datore, ma paga costi più alti e la tassa sulla prestazione (" +
      pct.format(r.aliquotaPrestazione * 100) + "%); fuori dal fondo si paga il " + pct.format(r.aliquotaLibera * 100) + "% sul solo guadagno e il bollo dello 0,2% l'anno.";
  }

  // 7. ricalcolo tutto e ridisegno
  function aggiorna() {
    var v = leggi(), box = $("blocco-risultato");
    if (!v) {
      box.classList.add("inattivo");
      $("avviso").innerHTML = '<p class="avviso">Correggi i campi evidenziati: sotto resta l\'ultimo risultato valido.</p>';
      return;
    }
    var p = parametri(v), r, curva = null, quota = 0, migliore = null;
    try {
      r = Confronto.simulaConfronto(p);
      if (r.tuttoFondo) {
        curva = Confronto.curvaBilanciamento(p, 100);
        migliore = curva.reduce(function (a, c) { return c.netto > a.netto ? c : a; });
        if (!toccato) {   // finché non muovi il cursore, mostro la suddivisione migliore
          v.bil = Math.round(migliore.quota * 100);
          imposta("bil", v.bil);
          p = parametri(v);
          r = Confronto.simulaConfronto(p);
        }
        quota = v.bil / 100;
      }
    } catch (e) {
      box.classList.add("inattivo");
      $("avviso").innerHTML = '<p class="avviso">' + e.message + "</p>";
      return;
    }
    box.classList.remove("inattivo");
    $("avviso").innerHTML = "";
    $("riepilogo").textContent = v.eta + "→" + v.pens + " anni · RAL " + eur.format(v.ral) + " · " + eur.format(v.accM) + " al mese · " +
      (PROFILO ? Confronto.config.profili.filter(function (x) { return x.id === PROFILO; })[0].nome : "Profilo personalizzato");
    $("riep-ip").textContent = (PROFILO ? Confronto.config.profili.filter(function (x) { return x.id === PROFILO; })[0].nome : "Personalizzato") + " · fondo " + pct.format(v.rgf) + "% (costi " + pct.format(v.ctf) + "%) · fuori " + pct.format(v.rgl) + "% (costi " + pct.format(v.ctl) + "%)";
    var minimo = Math.round(v.ral * Confronto.config.minimoDatore / 100);
    $("acc-aiuto").textContent = "= " + (accUnita === "p" ? eur2.format(v.accM) + " al mese" : pct.format(v.accM * 12 / v.ral * 100) + "% della RAL") + " · " + eur.format(v.accM * 12) + " l'anno";
    $("dat-aiuto").textContent = "= " + eur.format(v.ral * v.dat / 100) + " l'anno";
    $("info-datore").textContent = eur.format(v.accM * 12) + " l'anno. Il datore versa solo se nel fondo metti almeno lo " + pct.format(Confronto.config.minimoDatore) + "% della RAL (" + eur.format(minimo) +
      " l'anno). Nel fondo si deduce fino a " + eur2.format(limite) + " l'anno, contributo del datore compreso: oltre, ogni euro in più ti costa per intero.";
    $("riga-conf").classList.toggle("mosso", toccato);
    $("bil-ottimo").hidden = !toccato;
    $("bil-nota").textContent = toccato ? "" : "Stai vedendo la suddivisione che rende di più. Muovi il cursore per provarne un'altra.";
    $("bil").style.setProperty("--fondo", v.bil + "%");
    $("bil-out").textContent = curva ? Math.round(quota * 100) + "% fondo · " + Math.round((1 - quota) * 100) + "% fuori" : "–";
    $("costo-aiuto").textContent = curva ? "Nel fondo " + eur.format(p.versaFondo / 12) + " al mese (" + eur.format(p.versaFondo) + " l'anno, ne recuperi " + eur.format(p.versaFondo - Confronto.costoFondo(p, p.versaFondo)) +
      " di IRPEF" + (Confronto.datoreDi(p, p.versaFondo) > 0 ? " e il datore aggiunge " + eur.format(p.ral * p.datore / 100) : "") + "), fuori " + eur.format(p.versaLibero / 12) + " al mese. In tutto ti costa di tasca " + eur.format(r.costoAnno1) + " l'anno." : "Imposta un importo mensile.";
    ["grafico-bil", "grafico"].forEach(function (id) { $(id).innerHTML = ""; });
    if (!curva) {
      box.innerHTML = '<p class="avviso lieve">Imposta almeno un importo (nel fondo o fuori) per vedere il confronto.</p>';
      $("opzioni-bil").innerHTML = ""; $("bil-info").textContent = ""; $("legenda-bil").innerHTML = ""; $("nota-bil").textContent = "";
      $("legenda-grafico").innerHTML = ""; $("grafico-info").textContent = ""; $("tabella").innerHTML = ""; $("nota-tabella").textContent = "";
      $("mob-p").textContent = "–"; $("mob-delta").textContent = "";
      ultimo = null;
    } else {
      ultimo = {r: r, p: p, curva: curva, quota: quota};
      verdetto(r, p, migliore);
      graficoBilanciamento(r, p, curva, quota);
      graficoCrescita(r, p);
      tabella(r, p);
    }
    $("sottotitolo-bil").textContent = "Lo stesso importo mensile" + (curva ? " (" + eur.format((p.versaFondo + p.versaLibero) / 12) + ")" : "") + ", diviso in modo diverso tra fondo e investimento: il netto a " + p.pensione + " anni.";
    try {
      var h = new URLSearchParams();
      Object.keys(CAMPI).forEach(function (k) { if (v[k] !== CAMPI[k][0] && (k !== "bil" || toccato)) h.set(k, v[k]); });
      if (accUnita === "p") h.set("accu", "p");
      if (PROFILO !== "bilanciato") h.set("pf", PROFILO || "");
      history.replaceState(null, "", location.pathname + location.search + (h.toString() ? "#" + h : ""));
    } catch (e) {}
  }

  function impostaUnita(u) {
    accUnita = u;
    [].forEach.call(document.querySelectorAll('input[name="acc-u"]'), function (r) { r.checked = r.value === u; });
  }

  // cambio € / %: il valore scritto si converte, l'importo resta lo stesso
  function cambiaUnita() {
    var ral = parseFloat($("ral").value), n = parseFloat(String($("acc").value).replace(",", "."));
    var nuova = document.querySelector('input[name="acc-u"]:checked').value;
    if (nuova !== accUnita && ral > 0 && n >= 0) {
      var euro = accUnita === "p" ? ral * n / 1200 : n;
      $("acc").value = Math.round((nuova === "p" ? euro / ral * 1200 : euro) * 100) / 100;
    }
    accUnita = nuova;
  }

  // clic sul grafico: sposto il cursore del bilanciamento
  function impostaQuota(q) {
    toccato = true;
    imposta("bil", Math.round(q * 100));
    aggiorna();
  }

  // "Calcola": comprimo i dati, mostro risultati e grafici (ridisegnati ora che hanno una larghezza)
  function calcola() {
    if (!leggi()) return;
    $("dati").open = false;
    $("risultati").hidden = false;
    aggiorna();
    $("dati").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  }

  function profilo(id) {
    var pr = Confronto.config.profili.filter(function (x) { return x.id === id; })[0];
    if (!pr) return;
    PROFILO = id;
    ["rgf", "rgl"].forEach(function (k) { imposta(k, pr.rendimento); });
    ["tsf", "tsl"].forEach(function (k) { imposta(k, pr.titoliStato); });
    mostraProfilo();
  }
  function mostraProfilo() {
    [].forEach.call(document.querySelectorAll('input[name="profilo"]'), function (r) { r.checked = r.value === PROFILO; });
  }

  function ripristina() {
    Object.keys(CAMPI).forEach(function (k) { imposta(k, CAMPI[k][0]); });
    profilo("bilanciato");
    impostaUnita("e");
    toccato = false;
    aggiorna();
  }

  // 8. eventi
  $("profilo").addEventListener("input", function (e) {
    var id = e.target.id;
    if (e.target.name === "acc-u") cambiaUnita();
    if (/-r$/.test(id)) imposta(id.slice(0, -2), e.target.value);
    else if ($(id + "-r")) $(id + "-r").value = e.target.value;
    if (["rgf", "rgl", "tsf", "tsl"].indexOf(id) >= 0) { PROFILO = ""; mostraProfilo(); }
    aggiorna();
  });
  [].forEach.call(document.querySelectorAll('input[name="profilo"]'), function (el) {
    el.addEventListener("change", function () { profilo(el.value); aggiorna(); });
  });
  $("info-btn").addEventListener("click", function () {
    var apri = $("info-datore").hidden;
    $("info-datore").hidden = !apri;
    $("info-btn").setAttribute("aria-expanded", apri);
  });
  document.querySelectorAll("input[name=scala-tab]").forEach(function (el) { el.addEventListener("change", function () { if (ultimo) tabella(ultimo.r, ultimo.p); }); });
  $("bil").addEventListener("input", function () { toccato = true; aggiorna(); });
  $("bil-ottimo").addEventListener("click", function () { toccato = false; aggiorna(); });
  $("profilo").addEventListener("submit", function (e) { e.preventDefault(); calcola(); });
  [].forEach.call(document.querySelectorAll(".ripristina"), function (b) { b.addEventListener("click", function (e) { e.preventDefault(); ripristina(); }); });
  $("copia").addEventListener("click", function () {
    var b = $("copia"), t = b.textContent;
    var fatto = function () { b.textContent = "Link copiato"; setTimeout(function () { b.textContent = t; }, 1600); };
    try { navigator.clipboard.writeText(location.href).then(fatto, fatto); } catch (e) { fatto(); }
  });
  addEventListener("resize", function () {
    if (ultimo && !$("risultati").hidden && Math.abs($("grafico").clientWidth - W) > 20) {
      graficoBilanciamento(ultimo.r, ultimo.p, ultimo.curva, ultimo.quota);
      graficoCrescita(ultimo.r, ultimo.p);
    }
  });

  // all'apertura: predefiniti, poi i valori dal link se ci sono
  Object.keys(CAMPI).forEach(function (k) { imposta(k, CAMPI[k][0]); });
  try {
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.has("pf")) { PROFILO = h.get("pf"); if (PROFILO) profilo(PROFILO); mostraProfilo(); }
    h.forEach(function (val, k) {
      if (k === "accu" && val === "p") { impostaUnita("p"); }
      else if (CAMPI[k]) { imposta(k, val); if (k === "bil") toccato = true; }
    });
  } catch (e) {}
  mostraProfilo();

  limite = Busta.calcolaDeduzioni({previdenzaComplementare: 1e9, mensilita: 1});
  var dati = [["Anno fiscale", Busta.anno], ["Limite di deduzione", eur2.format(limite) + "/anno"], ["Rendimenti nel fondo", "20% · 12,5%"], ["Rendimenti fuori", "26% · 12,5%"], ["Bollo sul conto titoli", "0,2%"]];
  $("dati-modello").innerHTML = dati.map(function (d) { return "<li>" + d[0] + " <b>" + d[1] + "</b></li>"; }).join("");

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (voci) {
      $("barra-mobile").classList.toggle("visibile", !voci[0].isIntersecting && voci[0].boundingClientRect.top > 0);
    }).observe($("risultato"));
  }
  aggiorna();
  if (location.hash.length > 1) calcola();   // link condiviso: salto direttamente al confronto
})();
