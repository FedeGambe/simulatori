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
  var INTERRUTTORI = ["tfr"];
  var stato = {tfr: true, periodo: "1", vista: "euro"};   // vista del grafico "quanto versare": "euro" o "pct"   // periodo del bilancio: "1" primo anno, "tot" tutti gli anni
  var COMUNE_PREDEFINITO = "F257";
  var etichette = {};    // "MODENA (MO)" -> codice catastale
  var ultimo = null, ultimiDati = null;     // ultimo risultato valido (e i suoi dati), per ridisegnare i grafici se cambia la larghezza
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

  // somma di una voce sugli anni
  function somma(righe, k) { return righe.reduce(function (t, x) { return t + x[k]; }, 0); }

  // bilancio: il tuo versamento esce dalla busta, l'IRPEF recuperata e il contributo dell'azienda tornano; in fondo il saldo
  function bilancio(r) {
    var righe = stato.periodo === "tot" ? r.righe : r.righe.slice(0, 1);
    var w = somma(righe, "lavoratore"), irpef = somma(righe, "risparmio"), d = somma(righe, "datore"), f = somma(righe, "tfr");
    var saldo = irpef + d - w, quando = stato.periodo === "tot" ? "In " + r.anni + " anni" : "Il primo anno";
    var minimo = Math.min(0, -w), massimo = Math.max(0, irpef + d - w, saldo, 1), ampio = massimo - minimo || 1;
    var P = function (v) { return (v - minimo) / ampio * 100; };
    var segno = function (v) { return (v < 0 ? "−" : "+") + eur.format(Math.abs(v)); };
    var riga = function (nome, nota, da, a, classe, val, cls) {
      return '<div class="riga' + (cls || "") + '"><div class="nome"><b>' + nome + "</b><span>" + nota + '</span></div><div class="pista">' +
        '<span class="seg ' + classe + '" style="left:' + P(Math.min(da, a)).toFixed(2) + "%;width:" + Math.abs(P(a) - P(da)).toFixed(2) + '%"></span>' +
        '<span class="zero" style="left:' + P(0).toFixed(2) + '%"></span></div><div class="val ' + (val < 0 ? "giu" : "su") + '">' + segno(val) + "</div></div>";
    };
    $("cascata").innerHTML =
      riga("Il tuo versamento", "esce dalla busta paga", 0, -w, "mio", -w) +
      riga("IRPEF recuperata", "ti torna con la deduzione", -w, irpef - w, "irpef", irpef) +
      riga("Contributo dell'azienda", "lo ricevi solo aderendo", irpef - w, saldo, "az", d) +
      riga(saldo >= 0 ? "Ci guadagni" : "Ci rimetti", "rispetto a quanto versi", 0, saldo, "saldo", saldo, " estremo finale");
    $("sottotitolo-bilancio").textContent = w > 0 ?
      quando + " versi " + eur.format(w) + ": il fisco te ne restituisce " + eur.format(irpef) + " e l'azienda ne aggiunge " + eur.format(d) + "." :
      "Inserisci un tuo contributo per vedere quanto ti costa e quanto ricevi.";
    var rq = roiDi(r, stato.periodo === "tot");
    $("opzioni-bilancio").innerHTML = [
      ["Ti costa davvero", eur.format(w - irpef), "Il tuo versamento meno l'IRPEF recuperata", false],
      ["Entra nel fondo", eur.format(w + d + f), "Tu " + eur.format(w) + " · azienda " + eur.format(d) + (f > 0 ? " · TFR " + eur.format(f) : ""), false],
      ["Su 100 € che versi", w > 0 ? "+" + eur.format((irpef + d) / w * 100) : "–", "Ti tornano tra IRPEF recuperata e contributo dell'azienda", true],
      ["ROI", roiTesto(rq), "Versi " + eur.format(rq.w) + ", ottieni " + eur.format(rq.ottieni) + " tra fondo e IRPEF recuperata", false]
    ].map(voce).join("");
    $("nota-bilancio").textContent = "Cifre versate, senza rendimenti. Il TFR non è nel conto: è tuo comunque, nel fondo o in azienda.";
  }

  // ROI: quanto ottieni rispetto a quello che versi di tasca tua. Senza TFR e già accumulato: erano tuoi comunque.
  // Tutti gli anni: netto finale + IRPEF recuperata. Primo anno: valore del fondo a fine anno + IRPEF recuperata − tassa sulla prestazione
  // ponytail: nel primo anno i rendimenti includono quelli sul già accumulato e la tassa è l'aliquota finale
  function roiDi(r, tot, lordo) {
    var x = r.righe[0], w = tot ? r.versamenti.lavoratore : x.lavoratore;
    return {w: w, ottieni: tot ? (lordo ? r.montante : r.nettoFinale) + r.risparmioIrpef - r.versamenti.tfr - r.punti[0].montante
      : w + x.risparmio + x.datore + r.punti[1].rendimenti - (x.dedotto + x.datore) * r.aliquotaPrestazione};
  }
  function roiTesto(q) { return q.w > 0 ? (q.ottieni >= q.w ? "+" : "−") + pct.format(Math.abs(q.ottieni / q.w - 1) * 100) + "%" : "–"; }

  function roi(r) {
    var prima = roiDi(r, true, true), dopo = roiDi(r, true);
    $("roi-prima").textContent = roiTesto(prima);
    $("roi-dopo").textContent = roiTesto(dopo);
    $("roi-sub").textContent = dopo.w > 0 ? "Versi " + eur.format(dopo.w) + ", ottieni " + eur.format(prima.ottieni) + " prima delle tasse, " + eur.format(dopo.ottieni) + " dopo" : "Inserisci un tuo contributo";
  }

  function voce(x) {
    return '<li class="' + (x[3] ? "best" : "") + '"><span>' + x[0] + "</span><b>" + x[1] + "</b><small>" + x[2] + "</small></li>";
  }

  // grafico: versamenti cumulati per voce (aree impilate) e linea del valore del fondo
  function grafico(r) {
    W = Math.max(300, $("grafico").clientWidth || 800); H = Math.round(Math.max(230, W * 0.42));
    var p = r.punti, e0 = p[0].eta, anni = r.anni, m0 = p[0].montante;
    var cum = [{gia: m0, mio: 0, az: 0, tfr: 0}];
    r.righe.forEach(function (x, t) {
      var c = cum[t];
      cum.push({gia: m0, mio: c.mio + x.lavoratore, az: c.az + x.datore, tfr: c.tfr + x.tfr});
    });
    var voci = [["gia", "Già accumulato", "var(--ink-3)", ".45"], ["mio", "I tuoi versamenti", "var(--rosso)", ".85"], ["az", "Contributo dell'azienda", "var(--teal)", ".85"], ["tfr", "TFR", "var(--sabbia)", ".95"]]
      .filter(function (v) { return v[0] !== "gia" || m0 > 0; }).filter(function (v) { return v[0] !== "tfr" || stato.tfr; });
    var massimo = 1;
    p.forEach(function (q, k) { massimo = Math.max(massimo, q.montante, cum[k].gia + cum[k].mio + cum[k].az + cum[k].tfr); });
    var s = passo(massimo), cima = Math.ceil(massimo / s) * s;
    var X = function (eta) { return L + (eta - e0) / anni * (W - L - R); };
    var Y = function (v) { return T + (1 - v / cima) * (H - T - B); };
    var linea = function (f) { return p.map(function (q, k) { return X(q.eta).toFixed(1) + "," + Y(f(k)).toFixed(1); }); };
    var html = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Versamenti accumulati e valore del fondo anno per anno">';
    for (var v = 0; v <= cima + 1; v += s) {
      html += '<line class="asse" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + breve(v) + "</text>";
    }
    var salto = anni > 40 ? 10 : anni > 15 ? 5 : anni > 6 ? 2 : 1;
    for (var a = Math.ceil(e0 / salto) * salto; a <= e0 + anni; a += salto) {
      html += '<text x="' + X(a) + '" y="' + (H - 12) + '" text-anchor="middle">' + a + "</text>";
    }
    // pile: ogni voce va da sotto (somma delle precedenti) a sopra
    var sotto = p.map(function () { return 0; }), cimaPila;
    voci.forEach(function (vc) {
      var sopra = sotto.map(function (b, k) { return b + cum[k][vc[0]]; });
      var su = linea(function (k) { return sopra[k]; }), giu = linea(function (k) { return sotto[k]; }).reverse();
      html += '<path d="M' + su.join("L") + "L" + giu.join("L") + 'Z" fill="' + vc[2] + '" opacity="' + vc[3] + '"/>';
      sotto = sopra;
    });
    cimaPila = sotto;
    // rendimenti: tra la cima delle pile e il valore del fondo
    html += '<path d="M' + linea(function (k) { return p[k].montante; }).join("L") + "L" + linea(function (k) { return cimaPila[k]; }).reverse().join("L") + 'Z" fill="var(--verde)" opacity=".35"/>' +
      '<polyline points="' + linea(function (k) { return p[k].montante; }).join(" ") + '" fill="none" stroke="var(--verde)" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<line id="cur-l" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink)" stroke-width="1"/>' +
      '<circle id="cur-m" r="5" fill="var(--verde)" stroke="var(--ink)" stroke-width="2"/>' +
      '<text x="' + (W - R) + '" y="' + (H - 1) + '" text-anchor="end">età</text></svg>';
    $("grafico").innerHTML = html;
    $("legenda-grafico").innerHTML = voci.map(function (vc) { return '<span><i style="background:' + vc[2] + ";opacity:" + vc[3] + '"></i>' + vc[1] + "</span>"; }).join("") +
      '<span><i style="background:var(--verde);opacity:.35"></i>Rendimenti netti</span><span><i style="background:var(--verde);height:4px;vertical-align:3px"></i>Valore del fondo</span>';
    var svg = $("grafico").firstChild;
    function punta(k) {
      var q = p[k], c = cum[k];
      $("cur-l").setAttribute("x1", X(q.eta)); $("cur-l").setAttribute("x2", X(q.eta));
      $("cur-m").setAttribute("cx", X(q.eta)); $("cur-m").setAttribute("cy", Y(q.montante));
      $("grafico-info").innerHTML = "<b>A " + q.eta + " anni</b> · fondo " + eur.format(q.montante) + " · tuoi " + eur.format(c.mio) + " · azienda " + eur.format(c.az) +
        (stato.tfr ? " · TFR " + eur.format(c.tfr) : "") + (m0 > 0 ? " · già accumulato " + eur.format(m0) : "") + " · rendimenti " + eur.format(q.rendimenti);
    }
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * W;
      punta(Math.max(0, Math.min(anni, Math.round((x - L) / (W - L - R) * anni))));
    });
    svg.addEventListener("pointerleave", function () { punta(anni); });
    punta(anni);
  }

  function schede(r) {
    var v = r.versamenti, media = r.risparmioIrpef / r.anni;
    return [
      ["Fondo a " + (r.punti[r.anni].eta) + " anni (lordo)", eur.format(r.montante), "Prima della tassa sulla prestazione", false],
      ["Versamenti totali", eur.format(v.totale), "Tu " + eur.format(v.lavoratore) + " · datore " + eur.format(v.datore) + " · TFR " + eur.format(v.tfr), false],
      ["Rendimenti netti", eur.format(r.rendimenti), "Dopo costi e imposta sostitutiva al " + pct.format(r.aliquotaRendimenti * 100) + "%", false],
      ["Risparmio IRPEF", eur.format(r.risparmioIrpef), "Circa " + eur.format(media) + " l'anno" + (v.lavoratore > 0 ? " · ogni 100 € versati ti costano " + Math.round(r.costoReale * 100) + " €" : ""), true],
      ["Tassa sulla prestazione", eur.format(r.imposta), pct2.format(r.aliquotaPrestazione * 100) + "% su contributi dedotti, datore e TFR (i rendimenti sono già tassati)", false]
    ].map(voce).join("");
  }

  // quanto conviene versare: per ogni versamento annuo (primo anno) l'IRPEF recuperata e il costo vero
  function conviene(r, v) {
    var W, H;   // misure proprie: quelle comuni le cambia il grafico della crescita, disegnato dopo
    var w0 = r.righe[0].lavoratore, d0 = r.righe[0].datore, limite = Busta.calcolaDeduzioni({previdenzaComplementare: 1e9, mensilita: 1});
    var soglia = Math.max(0, limite - d0);   // oltre questa somma il tuo versamento non si deduce più
    var fine = Math.max(soglia * 1.6, w0 * 1.25, 1000), n = 48, punti = [];
    // maggiorazione della detrazione per lavoro dipendente (art. 13 c. 1.1 TUIR): spetta solo tra due redditi.
    // Il versamento si deduce e abbassa il reddito: quando passa una delle due soglie la detrazione salta e la curva fa un gradino.
    var m = Busta.maggiorazione, imp0 = Busta.calcolaNetto(r.righe[0].ral, {mensilita: 14, comune: v.comune}).imponibileFiscale;
    // il punto esatto si cerca sull'imponibile vero (in busta è arrotondato mese per mese)
    var imponibile = function (x) { return Busta.calcolaNetto(r.righe[0].ral, {mensilita: 14, comune: v.comune, deduzioni: {previdenzaComplementare: x / 14}}).imponibileFiscale; };
    var gradini = [[m.da, -1], [m.a, 1]].map(function (g) {
      var a = Math.max(0, imp0 - g[0] - 50), b = imp0 - g[0] + 50;
      for (var i = 0; i < 40; i++) { var c = (a + b) / 2; if (imponibile(c) > g[0]) a = c; else b = c; }
      return {x: b, reddito: g[0], segno: g[1]};
    }).filter(function (g) { return imp0 > g.reddito && g.x > 0 && g.x < soglia; });
    var xs = [];
    for (var k = 0; k <= n; k++) xs.push(fine * k / n);
    xs.push(soglia);
    gradini.forEach(function (g) { xs.push(g.x - 0.01, g.x); });
    xs.sort(function (a, b) { return a - b; }).forEach(function (x) { punti.push(calcola(x)); });
    function calcola(x) {
      var q = Fondo.simulaFondo({
        eta: v.eta, pensione: v.eta + 1, ral: v.ral, comune: v.comune, lavoratore: {valore: x, unita: "e"}, datore: {valore: d0, unita: "e"},
        tfr: false, rendimento: 0, costi: 0, titoliStato: 0, inflazione: 0, crescita: 0
      }).righe[0];
      return {x: x, irpef: q.risparmio, costo: x - q.risparmio};
    }
    var aSoglia = calcola(soglia), tuo = calcola(w0);
    // gradino in giù: fin dove si recupera la maggiorazione persa
    gradini.forEach(function (g) {
      g.prima = calcola(g.x - 0.01).irpef;
      if (g.segno > 0) return;
      var a = g.x, b = soglia;
      if (calcola(b).irpef < g.prima) { g.recupero = null; return; }
      for (var i = 0; i < 30; i++) { var c = (a + b) / 2; if (calcola(c).irpef >= g.prima) b = c; else a = c; }
      g.recupero = b;
    });
    $("nota-conviene").innerHTML = gradini.map(function (g) {
      var dove = "Versando " + eur.format(g.x) + " l'anno il tuo reddito imponibile scende " + (g.segno < 0 ? "sotto " : "a ") + eur.format(g.reddito) + ": ";
      if (g.segno > 0) return "<p>" + dove + "da lì hai diritto alla maggiorazione di " + eur.format(m.importo) + " della detrazione per lavoro dipendente, che spetta solo tra " + eur.format(m.da) + " e " + eur.format(m.a) + " di reddito. La curva fa un salto in su.</p>";
      return "<p>" + dove + "perdi la maggiorazione di " + eur.format(m.importo) + " della detrazione per lavoro dipendente, che spetta solo tra " + eur.format(m.da) + " e " + eur.format(m.a) + " di reddito. " +
        (g.recupero ? "Tra " + eur.format(g.x) + " e " + eur.format(g.recupero) + " recuperi meno IRPEF che versando " + eur.format(g.x) + ": se puoi, fermati poco prima di " + eur.format(g.x) + " oppure supera " + eur.format(g.recupero) + "."
          : "Fino al limite di deduzione non la recuperi: conviene fermarsi poco prima di " + eur.format(g.x) + " o arrivare al limite valutando la differenza.") + "</p>";
    }).join("");
    $("nota-conviene").hidden = !gradini.length;

    // rendimento sull'ultimo euro: a gradini, tra un punto e il successivo; il salto della maggiorazione
    // (due punti a un centesimo) è una perdita o un guadagno una tantum, non un rendimento: resta fuori
    var marg = [];
    punti.forEach(function (q, k) {
      var a = punti[k - 1];
      if (a && q.x - a.x > 1) marg.push({da: a.x, a: q.x, v: (q.irpef - a.irpef) / (q.x - a.x) * 100});
    });
    var margDi = function (x) {
      for (var k = 0; k < marg.length; k++) if (x < marg[k].a || k === marg.length - 1) return marg[k].v;
      return 0;
    };
    var perc = stato.vista === "pct";

    W = Math.max(300, $("grafico-conviene").clientWidth || 800); H = Math.round(Math.max(230, W * 0.4));
    var basso = 0, alto = fine;
    if (perc) {
      alto = 1; basso = 0;
      punti.forEach(function (q) { if (q.x > 0) alto = Math.max(alto, q.irpef / q.x * 100); });
      marg.forEach(function (t) { alto = Math.max(alto, t.v); basso = Math.min(basso, t.v); });
    }
    var s = passo(alto - basso), cima = Math.ceil(alto / s) * s, fondo = Math.floor(basso / s) * s;
    var X = function (x) { return L + x / fine * (W - L - R); };
    var Y = function (y) { return T + (cima - y) / (cima - fondo) * (H - T - B); };
    var etic = function (y) { return perc ? num.format(y) + "%" : breve(y); };
    var poli = function (pts, colore, sp, tratto) {
      return '<polyline points="' + pts.map(function (q) { return X(q[0]).toFixed(1) + "," + Y(q[1]).toFixed(1); }).join(" ") + '" fill="none" stroke="' + colore + '" stroke-width="' + sp + '"' + (tratto ? ' stroke-dasharray="' + tratto + '"' : "") + ' stroke-linejoin="round"/>';
    };
    var serie = function (k) { return punti.map(function (q) { return [q.x, q[k]]; }); };
    var html = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + (perc ? "Rendimento della deducibilità per ogni versamento annuo" : "IRPEF recuperata e costo vero per ogni versamento annuo") + '">';
    html += '<rect x="' + X(soglia).toFixed(1) + '" y="' + T + '" width="' + (W - R - X(soglia)).toFixed(1) + '" height="' + (H - T - B) + '" fill="var(--sabbia)" opacity=".18"/>';
    for (var y = fondo; y <= cima + s / 100; y += s) {
      html += '<line class="asse" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(y) + '" y2="' + Y(y) + '"' + (y === 0 && fondo < 0 ? ' style="stroke:var(--ink-3)"' : "") + '/><text x="' + (L - 8) + '" y="' + (Y(y) + 4) + '" text-anchor="end">' + etic(y) + "</text>";
    }
    var sx = passo(fine);
    for (var a = 0; a <= fine + 1; a += sx) {
      html += '<text x="' + X(a) + '" y="' + (H - 12) + '" text-anchor="middle">' + breve(a) + "</text>";
    }
    html += '<line x1="' + X(soglia) + '" x2="' + X(soglia) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="4 4"/>' +
      '<text x="' + (X(soglia) + (X(soglia) > W * 0.65 ? -6 : 6)) + '" y="' + (T + 12) + '" text-anchor="' + (X(soglia) > W * 0.65 ? "end" : "start") + '" style="fill:var(--ink-2)">limite ' + eur.format(soglia) + "</text>" +
      gradini.map(function (g) {
        return '<line x1="' + X(g.x) + '" x2="' + X(g.x) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--arancio)" stroke-width="1.5" stroke-dasharray="2 4"/>' +
          '<text x="' + (X(g.x) + 6) + '" y="' + (H - B - 8) + '" style="fill:var(--arancio)">' + (g.segno < 0 ? "−" : "+") + eur.format(m.importo) + "</text>";
      }).join("");
    if (perc) {
      var gradinoMarg = [];
      marg.forEach(function (t) { gradinoMarg.push([t.da, t.v], [t.a, t.v]); });
      html += poli(gradinoMarg, "var(--teal)", 1.5, "5 4") +
        poli(punti.filter(function (q) { return q.x > 0; }).map(function (q) { return [q.x, q.irpef / q.x * 100]; }), "var(--verde)", 2);
    } else {
      html += poli(serie("x"), "var(--rosso)", 2) + poli(serie("costo"), "var(--ink)", 1.5, "5 4") + poli(serie("irpef"), "var(--verde)", 2);
    }
    html += '<line id="cv-l" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink)" stroke-width="1"/>' +
      (perc ? "" : '<circle id="cv-v" r="5" fill="var(--rosso)" stroke="var(--ink)" stroke-width="2"/>') +
      '<circle id="cv-i" r="5" fill="var(--verde)" stroke="var(--ink)" stroke-width="2"/><circle id="cv-c" r="5" fill="' + (perc ? "var(--teal)" : "var(--bg)") + '" stroke="var(--ink)" stroke-width="2"/>' +
      '<text x="' + (W - R) + '" y="' + (H - 1) + '" text-anchor="end">tuo versamento annuo</text></svg>';
    $("grafico-conviene").innerHTML = html;
    $("legenda-conviene").innerHTML = (perc ?
      '<span><i style="background:var(--verde)"></i>Quanto ti torna in media su quello che versi</span><span><i style="background:var(--teal)"></i>Quanto ti torna su ogni euro in più</span>' :
      '<span><i style="background:var(--rosso)"></i>Il tuo versamento</span><span><i style="background:var(--verde)"></i>IRPEF recuperata</span><span><i style="background:var(--ink)"></i>Ti costa davvero</span>') +
      '<span><i style="background:var(--sabbia)"></i>Oltre il limite di deduzione</span>';
    var svg = $("grafico-conviene").firstChild;
    function punta(q) {
      var media = q.x > 0 ? q.irpef / q.x * 100 : 0, ultimo = margDi(q.x);
      $("cv-l").setAttribute("x1", X(q.x)); $("cv-l").setAttribute("x2", X(q.x));
      $("cv-i").setAttribute("cx", X(q.x)); $("cv-i").setAttribute("cy", Y(perc ? media : q.irpef));
      $("cv-c").setAttribute("cx", X(q.x)); $("cv-c").setAttribute("cy", Y(perc ? ultimo : q.costo));
      $("cv-i").style.display = perc && q.x <= 0 ? "none" : "";
      if (!perc) { $("cv-v").setAttribute("cx", X(q.x)); $("cv-v").setAttribute("cy", Y(q.x)); }
      $("conviene-info").innerHTML = "<b>Versando " + eur.format(q.x) + " l'anno</b> · " + (perc ?
        (q.x > 0 ? "ti torna il " + pct.format(media) + "% (" + eur.format(q.irpef) + " di IRPEF)" : "nessun versamento") + " · su ogni euro in più ti torna il " + pct.format(ultimo) + "%" :
        "IRPEF recuperata " + eur.format(q.irpef) + " · ti costa davvero " + eur.format(q.costo) + (q.x > 0 ? " · ogni 100 € ti costano " + Math.round(q.costo / q.x * 100) + " € (risparmi il " + pct.format((1 - q.costo / q.x) * 100) + "%)" : "")) +
        gradini.filter(function (g) { return g.segno < 0 && g.recupero && q.x >= g.x && q.x < g.recupero; })
          .map(function () { return " · <b>qui hai perso la maggiorazione di " + eur.format(m.importo) + "</b>"; }).join("");
    }
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), x = Math.max(0, Math.min(fine, ((e.clientX - rect.left) / rect.width * W - L) / (W - L - R) * fine));
      punta(calcola(Math.round(x / 10) * 10));
    });
    svg.addEventListener("pointerleave", function () { punta(tuo); });
    punta(tuo);
    fasce(soglia, gradini, calcola, imponibile, w0, m);
    var margine = aSoglia.x > 0 ? Math.round(aSoglia.irpef / aSoglia.x * 100) : 0;
    $("sottotitolo-conviene").textContent = soglia > 0 ?
      "Fino a " + eur.format(soglia) + " l'anno il tuo versamento si deduce e ti torna circa il " + margine + "% come IRPEF; oltre, ogni euro in più ti costa per intero." :
      "Il contributo dell'azienda copre già tutto il limite di deduzione: ogni tuo euro in più ti costa per intero.";
    var spazio = soglia - w0;
    $("opzioni-conviene").innerHTML = [
      ["Somma che conviene", eur.format(soglia), "Il massimo che deduci ogni anno: limite " + eur.format(limite) + (d0 > 0 ? " meno " + eur.format(d0) + " dell'azienda" : ""), true],
      ["Oggi versi", eur.format(w0), "IRPEF recuperata " + eur.format(tuo.irpef) + " · ti costa " + eur.format(tuo.costo), false],
      [spazio >= 0 ? "Puoi ancora dedurre" : "Oltre il limite", eur.format(Math.abs(spazio)),
        spazio >= 0 ? "Versandoli recuperi altri " + eur.format(aSoglia.irpef - tuo.irpef) + " di IRPEF" : "Questa parte non si deduce: ti costa per intero", false]
    ].map(voce).join("");
  }

  // fascia per fascia: fino al limite, tratti in cui ogni euro in più rende la stessa percentuale.
  // Passi da 10 €: i confini sono precisi a 10 € (i gradini della maggiorazione sono esatti).
  function fasce(soglia, gradini, calcola, imponibile, w0, m) {
    var passoF = 10, xs = [];
    for (var x = 0; x < soglia; x += passoF) xs.push(x);
    xs.push(soglia);
    gradini.forEach(function (g) { xs.push(g.x - 0.01, g.x); });
    xs.sort(function (a, b) { return a - b; });
    var irpef = xs.map(function (x) { return calcola(x).irpef; });
    var tratti = [];   // {da, a, v} senza i salti della maggiorazione
    for (var k = 1; k < xs.length; k++) {
      if (xs[k] - xs[k - 1] > 1) tratti.push({da: xs[k - 1], a: xs[k], d: irpef[k] - irpef[k - 1]});
    }
    // l'IRPEF in busta è arrotondata mese per mese: a 10 € la resa oscilla di qualche decimo.
    // Una nuova fascia parte quando la resa si sposta di più di 1,5 punti dalla media della fascia.
    var gruppi = [];
    tratti.forEach(function (t) {
      var v = t.d / (t.a - t.da) * 100, g = gruppi[gruppi.length - 1];
      var salto = g && gradini.some(function (s) { return Math.abs(s.x - t.da) < 1; });
      if (g && !salto && Math.abs(v - g.d / (g.a - g.da) * 100) < 1.5) { g.a = t.a; g.d += t.d; }
      else gruppi.push({da: t.da, a: t.a, d: t.d});
    });
    // i tratti più corti di 25 € (a cavallo di un cambio) vanno con la fascia prima
    gruppi = gruppi.reduce(function (out, g) {
      var p = out[out.length - 1], dopoSalto = gradini.some(function (s) { return Math.abs(s.x - g.da) < 1; });
      if (p && !dopoSalto && g.a - g.da < 25) { p.a = g.a; p.d += g.d; } else out.push(g);
      return out;
    }, []);
    var cumulato = 0, righe = "", vPrima = null;
    gruppi.forEach(function (g) {
      gradini.forEach(function (s) {
        if (Math.abs(s.x - g.da) < 1) {
          var salto = calcola(s.x).irpef - calcola(s.x - 0.01).irpef;
          cumulato += salto;
          righe += '<tr class="salto"><td colspan="2">A ' + eur.format(s.x) + '</td><td class="' + (salto < 0 ? "neg" : "pos") + '">' + (salto < 0 ? "−" : "+") + eur.format(Math.abs(salto)) + " una tantum</td><td class=\"perche\">" +
            (salto < 0 ? "Il reddito scende sotto " : "Il reddito scende a ") + eur.format(s.reddito) + ": " + (salto < 0 ? "perdi" : "ottieni") + " la maggiorazione della detrazione per lavoro dipendente</td><td>" + eur.format(cumulato) + "</td></tr>";
        }
      });
      cumulato += g.d;
      var v = g.d / (g.a - g.da) * 100, tuo = w0 >= g.da && w0 < g.a, cambio = "";
      if (vPrima !== null && Math.abs(v - vPrima) >= 1.5) cambio = "<b>" + (v < vPrima ? "Rende meno" : "Rende di più") + ":</b> ";
      vPrima = v;
      righe += '<tr class="' + (tuo ? "agg" : "") + '"><td>' + eur.format(g.da) + "</td><td>" + eur.format(g.a) + '</td><td class="pos"><b>' + pct.format(v) + "%</b></td><td class=\"perche\">" +
        cambio + "reddito da " + eur.format(imponibile(g.da)) + " a " + eur.format(imponibile(g.a)) + (tuo ? " · <b>qui sei tu</b>" : "") + "</td><td>" + eur.format(cumulato) + "</td></tr>";
    });
    righe += '<tr class="' + (w0 >= soglia ? "agg" : "") + '"><td>' + eur.format(soglia) + '</td><td>in su</td><td class="neg"><b>0%</b></td><td class="perche">Oltre il limite di deduzione: ogni euro in più ti costa per intero' + (w0 >= soglia ? " · <b>qui sei tu</b>" : "") + "</td><td>" + eur.format(cumulato) + "</td></tr>";
    $("tabella-fasce").innerHTML = '<div class="scorri"><table class="tabella larga fasce"><thead><tr><th>Da</th><th>A</th><th>Ti torna su ogni euro in più</th><th>Perché</th><th>IRPEF recuperata in tutto</th></tr></thead><tbody>' + righe + "</tbody></table></div>";
  }

  // anno per anno: medie e tabella semplice
  function guadagno(x) { return x.lavoratore > 0 ? "+" + num.format(Math.round((x.risparmio + x.datore) / x.lavoratore * 100)) + "%" : "–"; }
  function annuale(r) {
    var n = r.anni, tot = {lavoratore: r.versamenti.lavoratore, datore: r.versamenti.datore, risparmio: r.risparmioIrpef};
    $("opzioni-anni").innerHTML = [
      ["Il tuo versamento", eur.format(tot.lavoratore / n), "In media all'anno", false],
      ["Versamento dell'azienda", eur.format(tot.datore / n), "In media all'anno", false],
      ["IRPEF recuperata", eur.format(tot.risparmio / n), "In media all'anno, grazie alla deducibilità", false],
      ["Guadagno su quanto versi", guadagno(tot), "IRPEF recuperata più azienda, sul tuo versamento", true]
    ].map(voce).join("");
    function c(x) { return "<td>" + (x >= 0.5 ? eur.format(x) : "–") + "</td>"; }
    var righe = r.righe.map(function (x) {
      return "<tr><td>" + x.eta + "</td>" + c(x.lavoratore) + c(x.datore) + c(x.risparmio) + '<td class="pos">' + guadagno(x) + "</td><td><b>" + eur.format(x.montante) + "</b></td></tr>";
    }).join("");
    $("tabella").innerHTML = '<div class="scorri alta"><table class="tabella larga"><thead><tr><th>Età</th><th>Tuo versamento</th><th>Azienda</th><th title="IRPEF e addizionali risparmiate grazie alla deduzione">IRPEF recuperata</th><th title="IRPEF recuperata più contributo dell\'azienda, diviso il tuo versamento">Guadagno su quanto versi</th><th>Fondo a fine anno</th></tr></thead><tbody>' +
      righe + "</tbody></table></div>";
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
    $("rend").textContent = "Stima su ipotesi di rendimento, costi e inflazione costanti: non è una previsione.";
    ultimo = r; ultimiDati = v;
    $("opzioni").innerHTML = schede(r);
    bilancio(r);
    roi(r);
    conviene(r, v);
    grafico(r);
    annuale(r);
    $("mob-p").textContent = eur.format(r.nettoFinale);
    $("mob-delta").textContent = "a " + v.pens + " anni";

    try {
      var p = new URLSearchParams();
      Object.keys(CAMPI).forEach(function (k) { if (v[k] !== CAMPI[k][0]) p.set(k, v[k]); });
      UNITA.forEach(function (k) { if ($(k + "-u").value !== "p") p.set(k + "u", "e"); });
      if (!stato.tfr) p.set("tfr", 0);
      if (stato.periodo !== "1") p.set("per", stato.periodo);
      if (stato.vista !== "euro") p.set("vis", stato.vista);
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
    stato.periodo = "1";
    stato.vista = "euro";
    document.querySelector('input[name="vista"][value="euro"]').checked = true;
    document.querySelector('input[name="periodo"][value="1"]').checked = true;
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
  [].forEach.call(document.querySelectorAll('input[name="periodo"], input[name="vista"]'), function (el) {
    el.addEventListener("change", function () { stato[el.name] = el.value; aggiorna(); });
  });
  addEventListener("resize", function () {
    if (ultimo && !$("esito").hidden && Math.abs($("grafico").clientWidth - W) > 20) { grafico(ultimo); conviene(ultimo, ultimiDati); }
  });
  [].forEach.call(document.querySelectorAll(".ripristina"), function (b) { b.addEventListener("click", ripristina); });

  // all'apertura: valori dal link, se ci sono
  try {
    new URLSearchParams(location.hash.slice(1)).forEach(function (val, k) {
      if (CAMPI[k]) $(k).value = val;
      else if (k === "tfr") stato.tfr = val !== "0";
      else if (k === "vis" && val === "pct") { stato.vista = "pct"; document.querySelector('input[name="vista"][value="pct"]').checked = true; }
      else if (k === "per" && val === "tot") { stato.periodo = "tot"; document.querySelector('input[name="periodo"][value="tot"]').checked = true; }
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
