// INTERFACCIA: legge le caselle, usa Fondo.simulaFondo (script.js), scrive nella pagina.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var eur = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always"});
  var eur2 = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR", useGrouping: "always"});
  var pct = new Intl.NumberFormat("it-IT", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  var pct2 = new Intl.NumberFormat("it-IT", {maximumFractionDigits: 2});
  var num = new Intl.NumberFormat("it-IT");

  // id: [predefinito, minimo, massimo, nome per l'errore]
  var CAMPI = {
    eta: [35, 16, 70, "Età"],
    pens: [67, 40, 80, "Età di pensionamento"],
    ral: [30000, 1000, 1e6, "RAL"],
    vl: [2, 0, 100000, "Il tuo contributo"],
    vd: [2, 0, 100000, "Contributo del datore"],
    m0: [0, 0, 5e6, "Montante già accumulato"],
    a0: [0, 0, 50, "Anni di iscrizione"],
    rg: [4, -5, 15, "Rendimento lordo"],
    ct: [1, 0, 5, "Costi"],
    ts: [30, 0, 100, "Quota in titoli di Stato"],
    inf: [2, 0, 10, "Inflazione"],
    cr: [2, -2, 10, "Crescita della retribuzione"]
  };
  var UNITA = ["vl", "vd"];   // contributi: % della RAL oppure € all'anno
  var INTERRUTTORI = ["tfr", "cmp"];   // cmp: nel confronto conto anche il contributo del datore
  var stato = {tfr: true, cmp: false};
  var COMUNE_PREDEFINITO = "F257";
  var etichette = {};    // "MODENA (MO)" -> codice catastale
  var ultimo = null;     // ultimo risultato valido, per ridisegnare i grafici se cambia la larghezza
  var L = 64, R = 16, T = 14, B = 34, W = 800, H = 320;   // misure del grafico (W segue la larghezza della pagina)

  function etichetta(c) { return c.nome + " (" + c.pr + ")"; }
  function valoreRadio(nome) { return document.querySelector('input[name="' + nome + '"]:checked').value; }
  function mostraInterruttori() {
    INTERRUTTORI.forEach(function (id) { $(id).setAttribute("aria-pressed", stato[id]); });
  }

  function suggerisci() {
    var testo = $("comune").value.split("(")[0];
    var trovati = Busta.cercaComuni(testo, 15);
    trovati.forEach(function (c) { etichette[etichetta(c).toUpperCase()] = c.codice; });
    $("elenco-comuni").innerHTML = trovati.map(function (c) { return '<option value="' + etichetta(c) + '">'; }).join("");
  }
  function impostaComune(codice) {
    var c = Busta.trovaComune(codice);
    etichette[etichetta(c).toUpperCase()] = c.codice;
    $("comune").value = etichetta(c);
  }

  // 1. leggo e controllo i valori; se uno è sbagliato mostro l'errore e restituisco null
  function leggi() {
    var v = {}, ok = true;
    Object.keys(CAMPI).forEach(function (id) {
      var c = CAMPI[id], el = $(id), err = $(id + "-e");
      var n = parseFloat(String(el.value).replace(",", "."));
      var max = UNITA.indexOf(id) >= 0 && $(id + "-u").value === "p" ? 100 : c[2];
      var bad = isNaN(n) || n < c[1] || n > max;
      el.setAttribute("aria-invalid", bad);
      err.hidden = !bad;
      err.textContent = bad ? c[3] + ": inserisci un valore tra " + num.format(c[1]) + " e " + num.format(max) + "." : "";
      if (bad) ok = false; else v[id] = n;
    });
    if (ok && v.pens <= v.eta) {
      $("pens").setAttribute("aria-invalid", true);
      $("pens-e").hidden = false;
      $("pens-e").textContent = "L'età di pensionamento deve essere maggiore dell'età di oggi.";
      ok = false;
    }
    var codice = etichette[$("comune").value.trim().toUpperCase()];
    $("comune").setAttribute("aria-invalid", !codice);
    $("comune-e").hidden = !!codice;
    $("comune-e").textContent = codice ? "" : "Scegli un comune dall'elenco.";
    if (!codice) ok = false; else v.comune = codice;
    return ok ? v : null;
  }

  // 2. scala "pulita" per l'asse verticale
  function passo(max) {
    var grezzo = max / 4, p = Math.pow(10, Math.floor(Math.log10(grezzo))), f = grezzo / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function breve(v) {
    return v >= 1e6 ? pct.format(v / 1e6) + " mln" : v >= 1000 ? num.format(Math.round(v / 1000)) + " mila" : String(Math.round(v));
  }

  // grafico: aree impilate (versamenti, rendimenti netti) e linea del risparmio IRPEF cumulato
  function grafico(r) {
    W = Math.max(300, $("grafico").clientWidth || 800); H = Math.round(Math.max(230, W * 0.4));
    var p = r.punti, e0 = p[0].eta, anni = r.anni;
    var massimo = Math.max(p[anni].montante, p[anni].risparmio, 1), s = passo(massimo), cima = Math.ceil(massimo / s) * s;
    var X = function (eta) { return L + (eta - e0) / anni * (W - L - R); };
    var Y = function (v) { return T + (1 - v / cima) * (H - T - B); };
    function area(alto, basso) {
      var su = p.map(function (q) { return X(q.eta).toFixed(1) + "," + Y(alto(q)).toFixed(1); });
      var giu = p.map(function (q) { return X(q.eta).toFixed(1) + "," + Y(basso(q)).toFixed(1); }).reverse();
      return "M" + su.join("L") + "L" + giu.join("L") + "Z";
    }
    var html = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Crescita del fondo pensione anno per anno">';
    for (var v = 0; v <= cima + 1; v += s) {
      html += '<line class="asse" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + breve(v) + "</text>";
    }
    var salto = anni > 40 ? 10 : anni > 15 ? 5 : anni > 6 ? 2 : 1;
    for (var a = Math.ceil(e0 / salto) * salto; a <= e0 + anni; a += salto) {
      html += '<text x="' + X(a) + '" y="' + (H - 12) + '" text-anchor="middle">' + a + "</text>";
    }
    html += '<path d="' + area(function (q) { return q.versati; }, function () { return 0; }) + '" fill="var(--teal)" opacity=".85"/>' +
      '<path d="' + area(function (q) { return q.montante; }, function (q) { return q.versati; }) + '" fill="var(--verde)" opacity=".9"/>' +
      '<polyline points="' + p.map(function (q) { return X(q.eta).toFixed(1) + "," + Y(q.risparmio).toFixed(1); }).join(" ") + '" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-dasharray="6 4"/>' +
      '<line id="cur-l" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink)" stroke-width="1"/>' +
      '<circle id="cur-m" r="5" fill="var(--verde)" stroke="var(--ink)" stroke-width="2"/><circle id="cur-r" r="5" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>' +
      '<text x="' + (W - R) + '" y="' + (H - 1) + '" text-anchor="end">età</text></svg>';
    $("grafico").innerHTML = html;
    var svg = $("grafico").firstChild;
    function punta(k) {
      var q = p[k];
      $("cur-l").setAttribute("x1", X(q.eta)); $("cur-l").setAttribute("x2", X(q.eta));
      $("cur-m").setAttribute("cx", X(q.eta)); $("cur-m").setAttribute("cy", Y(q.montante));
      $("cur-r").setAttribute("cx", X(q.eta)); $("cur-r").setAttribute("cy", Y(q.risparmio));
      $("grafico-info").innerHTML = "<b>A " + q.eta + " anni</b> · fondo " + eur.format(q.montante) + " (versamenti " + eur.format(q.versati) +
        " + rendimenti netti " + eur.format(q.rendimenti) + ") · IRPEF risparmiata finora " + eur.format(q.risparmio);
    }
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * W;
      punta(Math.max(0, Math.min(anni, Math.round((x - L) / (W - L - R) * anni))));
    });
    svg.addEventListener("pointerleave", function () { punta(anni); });
    punta(anni);
  }

  // barre: IRPEF risparmiata in ciascun anno
  function barre(r) {
    var righe = r.righe, n = righe.length, H2 = 190, T2 = 10, B2 = 30;
    var massimo = Math.max.apply(null, righe.map(function (x) { return x.risparmio; }).concat(1)), s = passo(massimo), cima = Math.ceil(massimo / s) * s;
    var larg = (W - L - R) / n, Y = function (v) { return T2 + (1 - v / cima) * (H2 - T2 - B2); };
    var html = '<svg viewBox="0 0 ' + W + " " + H2 + '" role="img" aria-label="IRPEF risparmiata ogni anno">';
    for (var v = 0; v <= cima + 1; v += s) {
      html += '<line class="asse" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + breve(v) + "</text>";
    }
    righe.forEach(function (x, i) {
      var y = Y(x.risparmio);
      html += '<rect x="' + (L + i * larg + larg * 0.15).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (larg * 0.7).toFixed(1) + '" height="' + (H2 - B2 - y).toFixed(1) +
        '" fill="var(--ink)" opacity=".85"><title>A ' + x.eta + " anni: " + eur.format(x.risparmio) + "</title></rect>";
    });
    var salto = n > 40 ? 10 : n > 15 ? 5 : n > 6 ? 2 : 1;
    for (var a = Math.ceil(righe[0].eta / salto) * salto; a < righe[0].eta + n; a += salto) {
      html += '<text x="' + (L + (a - righe[0].eta + 0.5) * larg).toFixed(1) + '" y="' + (H2 - 10) + '" text-anchor="middle">' + a + "</text>";
    }
    $("grafico-irpef").innerHTML = html + "</svg>";
  }

  // confronto: fondo con la deduzione, stessi soldi investiti fuori, soldi tenuti in contanti
  function confronto(r) {
    var set = stato.cmp ? r.confronto.completo : r.confronto.soloTuo, anni = set.length - 1, fine = set[anni];
    var w0 = r.righe[0].lavoratore, s0 = stato.cmp ? r.righe[0].risparmio : r.righe[0].risparmioSolo, vantaggio = fine.fondo - fine.libero;
    $("sottotitolo-confronto").textContent = w0 > 0 ?
      "Il primo anno " + eur.format(w0) + " lordi: nel fondo ci vanno tutti e il fisco te ne restituisce " + eur.format(s0) + "; fuori dal fondo paghi " + eur.format(s0) + " di IRPEF e addizionali e ti restano " + eur.format(w0 - s0) + "." :
      "Inserisci un tuo contributo per confrontare le due strade.";
    $("opzioni-confronto").innerHTML = [
      ["Fondo pensione", eur.format(fine.fondo), "Netto a " + fine.eta + " anni, con la deduzione e dopo la tassa sulla prestazione", false],
      ["Investiti fuori dal fondo", eur.format(fine.libero), "Gli stessi soldi dopo l'IRPEF, con il " + pct.format(r.aliquotaLibera * 100) + "% di imposta sul guadagno", false],
      ["Tenuti in contanti", eur.format(fine.contanti), "Quello che resta in tasca dopo l'IRPEF, senza rendimento", false],
      [vantaggio >= 0 ? "Vantaggio del fondo" : "Vantaggio fuori dal fondo", (vantaggio >= 0 ? "+" : "−") + eur.format(Math.abs(vantaggio)),
        fine.libero > 0 ? "Il fondo vale " + pct.format(fine.fondo / fine.libero) + " volte l'investimento libero" : "", true]
    ].map(function (x) {
      return '<li class="' + (x[3] ? "best" : "") + '"><span>' + x[0] + "</span><b>" + x[1] + "</b><small>" + x[2] + "</small></li>";
    }).join("");
    $("nota-confronto").textContent = (stato.cmp ? "Contando anche il contributo del datore, che avresti solo aderendo al fondo. " : "Con i soli tuoi versamenti. ") +
      "Il TFR non è nel confronto. Il montante già accumulato non cambia tra le due strade.";

    W = Math.max(300, $("grafico-confronto").clientWidth || 800); H = Math.round(Math.max(230, W * 0.4));
    var e0 = set[0].eta, massimo = 1;
    set.forEach(function (q) { massimo = Math.max(massimo, q.fondo, q.libero, q.contanti); });
    var s = passo(massimo), cima = Math.ceil(massimo / s) * s;
    var X = function (eta) { return L + (eta - e0) / anni * (W - L - R); };
    var Y = function (v) { return T + (1 - v / cima) * (H - T - B); };
    var linea = function (k, colore, spessore, tratto) {
      return '<polyline points="' + set.map(function (q) { return X(q.eta).toFixed(1) + "," + Y(q[k]).toFixed(1); }).join(" ") + '" fill="none" stroke="' + colore +
        '" stroke-width="' + spessore + '"' + (tratto ? ' stroke-dasharray="' + tratto + '"' : "") + ' stroke-linejoin="round"/>';
    };
    var html = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Confronto tra fondo pensione, investimento libero e contanti">';
    for (var v = 0; v <= cima + 1; v += s) {
      html += '<line class="asse" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + breve(v) + "</text>";
    }
    var salto = anni > 40 ? 10 : anni > 15 ? 5 : anni > 6 ? 2 : 1;
    for (var a = Math.ceil(e0 / salto) * salto; a <= e0 + anni; a += salto) {
      html += '<text x="' + X(a) + '" y="' + (H - 12) + '" text-anchor="middle">' + a + "</text>";
    }
    html += linea("contanti", "var(--ink)", 2.5, "6 4") + linea("libero", "var(--teal)", 3) + linea("fondo", "var(--verde)", 3.5) +
      '<line id="cf-l" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink)" stroke-width="1"/>' +
      '<circle id="cf-f" r="5" fill="var(--verde)" stroke="var(--ink)" stroke-width="2"/><circle id="cf-a" r="5" fill="var(--teal)" stroke="var(--ink)" stroke-width="2"/><circle id="cf-c" r="5" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>' +
      '<text x="' + (W - R) + '" y="' + (H - 1) + '" text-anchor="end">età</text></svg>';
    $("grafico-confronto").innerHTML = html;
    var svg = $("grafico-confronto").firstChild;
    function punta(k) {
      var q = set[k];
      $("cf-l").setAttribute("x1", X(q.eta)); $("cf-l").setAttribute("x2", X(q.eta));
      [["cf-f", "fondo"], ["cf-a", "libero"], ["cf-c", "contanti"]].forEach(function (c) { $(c[0]).setAttribute("cx", X(q.eta)); $(c[0]).setAttribute("cy", Y(q[c[1]])); });
      $("confronto-info").innerHTML = "<b>A " + q.eta + " anni</b> · nel fondo " + eur.format(q.fondo) + " · investiti fuori " + eur.format(q.libero) + " · in contanti " + eur.format(q.contanti);
    }
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * W;
      punta(Math.max(0, Math.min(anni, Math.round((x - L) / (W - L - R) * anni))));
    });
    svg.addEventListener("pointerleave", function () { punta(anni); });
    punta(anni);
  }

  function tabella(r) {
    function c(x) { return "<td>" + (x >= 0.5 ? eur.format(x) : "–") + "</td>"; }
    var righe = r.righe.map(function (x) {
      return "<tr><td>" + x.eta + "</td>" + c(x.lavoratore) + c(x.datore) + c(x.tfr) + c(x.dedotto) + c(x.risparmio) + c(x.rendimento) + "<td><b>" + eur.format(x.montante) + "</b></td></tr>";
    }).join("");
    return '<div class="scorri alta"><table class="tabella larga"><thead><tr><th>Età a inizio anno</th><th>Tuo contributo</th><th>Datore</th><th>TFR</th><th title="Contributo dedotto dal reddito, entro il limite annuo">Dedotto</th><th title="IRPEF e addizionali risparmiate grazie alla deduzione">IRPEF risparmiata</th><th title="Rendimento netto di costi e imposta sostitutiva">Rendimento</th><th>Fondo a fine anno</th></tr></thead><tbody>' +
      righe + "</tbody></table></div>";
  }

  function schede(r) {
    var v = r.versamenti, media = r.risparmioIrpef / r.anni;
    var voci = [
      ["Fondo a " + (r.punti[r.anni].eta) + " anni (lordo)", eur.format(r.montante), "Prima della tassa sulla prestazione", false],
      ["Versamenti totali", eur.format(v.totale), "Tu " + eur.format(v.lavoratore) + " · datore " + eur.format(v.datore) + " · TFR " + eur.format(v.tfr), false],
      ["Rendimenti netti", eur.format(r.rendimenti), "Dopo costi e imposta sostitutiva al " + pct.format(r.aliquotaRendimenti * 100) + "%", false],
      ["Risparmio IRPEF", eur.format(r.risparmioIrpef), "Circa " + eur.format(media) + " l'anno" + (v.lavoratore > 0 ? " · ogni 100 € versati ti costano " + Math.round(r.costoReale * 100) + " €" : ""), true],
      ["Tassa sulla prestazione", eur.format(r.imposta), pct2.format(r.aliquotaPrestazione * 100) + "% su contributi dedotti, datore e TFR (i rendimenti sono già tassati)", false]
    ];
    return voci.map(function (x) {
      return '<li class="' + (x[3] ? "best" : "") + '"><span>' + x[0] + "</span><b>" + x[1] + "</b><small>" + x[2] + "</small></li>";
    }).join("");
  }

  // 3. ricalcolo tutto e ridisegno
  function aggiorna() {
    var v = leggi(), box = $("blocco-risultato");
    if (!v) {
      box.classList.add("inattivo");
      $("avviso").innerHTML = '<p class="avviso">Correggi i campi evidenziati: sotto resta l\'ultimo risultato valido.</p>';
      return;
    }
    var r;
    try {
      r = Fondo.simulaFondo({
        eta: v.eta, pensione: v.pens, ral: v.ral, comune: v.comune,
        lavoratore: {valore: v.vl, unita: $("vl-u").value}, datore: {valore: v.vd, unita: $("vd-u").value},
        tfr: stato.tfr, montante0: v.m0, anniIscritto: v.a0,
        rendimento: v.rg, costi: v.ct, titoliStato: v.ts, inflazione: v.inf, crescita: v.cr
      });
    } catch (e) {
      box.classList.add("inattivo");
      $("avviso").innerHTML = '<p class="avviso">' + e.message + "</p>";
      return;
    }
    box.classList.remove("inattivo");
    $("avviso").innerHTML = "";
    var contr = function (id) { return pct2.format(v[id]) + ($(id + "-u").value === "p" ? "%" : " €"); };
    $("riepilogo").textContent = "RAL " + eur.format(v.ral) + " · " + v.eta + "→" + v.pens + " anni · " + contr("vl") + " + " + contr("vd") + (stato.tfr ? " + TFR" : "");
    $("delta").textContent = "Dai " + v.eta + " ai " + v.pens + " anni: " + r.anni + " anni di versamenti";
    $("kpi").textContent = eur.format(r.nettoFinale);
    $("kpi-sub").textContent = "netto a " + v.pens + " anni · pari a " + eur.format(r.nettoFinaleReale) + " di oggi";
    $("kpi-mesi").textContent = "Totale accumulato " + eur.format(r.montante) + ", meno " + eur.format(r.imposta) + " di tassa sulla prestazione.";
    $("opzioni").innerHTML = schede(r);
    $("rend").textContent = "Stima su ipotesi di rendimento, costi e inflazione costanti: non è una previsione.";
    $("sottotitolo-grafico").textContent = "Versamenti e rendimenti netti si accumulano; la linea tratteggiata è l'IRPEF che risparmi versando al fondo.";
    ultimo = r;
    grafico(r);
    barre(r);
    confronto(r);
    $("tabella").innerHTML = tabella(r);
    $("mob-p").textContent = eur.format(r.nettoFinale);
    $("mob-delta").textContent = "a " + v.pens + " anni";

    try {
      var p = new URLSearchParams();
      Object.keys(CAMPI).forEach(function (k) { if (v[k] !== CAMPI[k][0]) p.set(k, v[k]); });
      UNITA.forEach(function (k) { if ($(k + "-u").value !== "p") p.set(k + "u", "e"); });
      if (!stato.tfr) p.set("tfr", 0);
      if (stato.cmp) p.set("cmp", 1);
      if (v.comune !== COMUNE_PREDEFINITO) p.set("comune", v.comune);
      history.replaceState(null, "", location.pathname + location.search + (p.toString() ? "#" + p : ""));
    } catch (e) {}
  }

  // "Calcola": se i dati sono validi mostro il risultato e comprimo l'inserimento
  function invia(fermo) {
    if (!leggi()) {
      var bad = document.querySelector("#profilo [aria-invalid=true]");
      if (bad) bad.focus();
      return;
    }
    $("esito").hidden = false;
    aggiorna();
    $("dati").open = false;
    if (!fermo) $("dati").scrollIntoView({behavior: "smooth"});
  }

  function ripristina() {
    if (!confirm("Cancellare tutti i dati inseriti e ricominciare?")) return;
    Object.keys(CAMPI).forEach(function (k) { $(k).value = CAMPI[k][0]; });
    UNITA.forEach(function (k) { $(k + "-u").value = "p"; });
    stato.tfr = true;
    stato.cmp = false;
    impostaComune(COMUNE_PREDEFINITO);
    mostraInterruttori();
    $("esito").hidden = true;
    $("dati").open = true;
    aggiorna();
  }

  // 4. eventi
  $("profilo").addEventListener("input", function (e) { if (e.target.id === "comune") suggerisci(); aggiorna(); });
  $("profilo").addEventListener("submit", function (e) { e.preventDefault(); invia(); });
  INTERRUTTORI.forEach(function (id) {
    $(id).addEventListener("click", function () { stato[id] = !stato[id]; mostraInterruttori(); aggiorna(); });
  });
  var tab = [].slice.call(document.querySelectorAll(".scheda-tab"));
  tab.forEach(function (t) {
    t.addEventListener("click", function () {
      var apri = t.getAttribute("aria-selected") !== "true";
      tab.forEach(function (x) {
        var su = apri && x === t;
        x.setAttribute("aria-selected", su);
        $(x.getAttribute("aria-controls")).hidden = !su;
      });
    });
  });
  addEventListener("resize", function () {
    if (ultimo && !$("esito").hidden && Math.abs($("grafico").clientWidth - W) > 20) { grafico(ultimo); barre(ultimo); confronto(ultimo); }
  });
  [].forEach.call(document.querySelectorAll(".ripristina"), function (b) { b.addEventListener("click", ripristina); });

  // all'apertura: valori dal link, se ci sono
  try {
    new URLSearchParams(location.hash.slice(1)).forEach(function (val, k) {
      if (CAMPI[k]) $(k).value = val;
      else if (k === "tfr") stato.tfr = val !== "0";
      else if (k === "cmp") stato.cmp = val === "1";
      else if (k === "vlu" || k === "vdu") $(k.slice(0, 2) + "-u").value = val === "e" ? "e" : "p";
      else if (k === "comune") impostaComune(val);
    });
  } catch (e) {}
  if (!$("comune").value || !etichette[$("comune").value.toUpperCase()]) impostaComune(COMUNE_PREDEFINITO);
  mostraInterruttori();
  suggerisci();

  var limite = Busta.calcolaDeduzioni({previdenzaComplementare: 1e9, mensilita: 1});
  var dati = [["Anno fiscale", Busta.anno], ["Limite di deduzione", eur2.format(limite) + "/anno"], ["Tassa sui rendimenti", "20% · 12,5%"], ["Tassa sulla prestazione", "15% → 9%"]];
  $("dati-modello").innerHTML = dati.map(function (d) { return "<li>" + d[0] + " <b>" + d[1] + "</b></li>"; }).join("");

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (voci) {
      $("barra-mobile").classList.toggle("visibile", !voci[0].isIntersecting && voci[0].boundingClientRect.top > 0);
    }).observe($("risultato"));
  }
  aggiorna();
  if (location.hash.length > 1) invia(true);   // link condiviso: subito il risultato
})();
