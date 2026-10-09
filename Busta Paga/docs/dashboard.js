// INTERFACCIA: legge le caselle, usa Busta.calcolaNetto (script.js), scrive nella pagina.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var eur = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR"});
  var pct = new Intl.NumberFormat("it-IT", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  var num = new Intl.NumberFormat("it-IT");

  // id: [predefinito, minimo, massimo, nome per l'errore]
  var CAMPI = {
    ral: [30000, 1000, 1e7, "RAL"],
    pl: [0, 0, 5000, "Previdenza complementare"],
    pd: [0, 0, 5000, "Previdenza complementare ditta"],
    ps: [0, 0, 5000, "Assistenza sanitaria"],
    at: [0, 0, 10000, "Altre trattenute"],
    f21: [0, 0, 10, "Figli a carico"],
    fd: [0, 0, 10, "Figli disabili"],
    alt: [0, 0, 10, "Altri familiari"]
  };
  var INTERRUTTORI = ["td", "app", "mass", "coniuge"];   // id dei pulsanti on/off
  var stato = {td: false, app: false, mass: false, coniuge: false};
  var COMUNE_PREDEFINITO = "F257";
  var etichette = {};    // "MODENA (MO)" -> codice catastale

  function etichetta(c) { return c.nome + " (" + c.pr + ")"; }

  function valoreRadio(nome) { return document.querySelector('input[name="' + nome + '"]:checked').value; }
  function impostaRadio(nome, valore) {
    [].forEach.call(document.querySelectorAll('input[name="' + nome + '"]'), function (r) { r.checked = r.value === String(valore); });
  }

  function mostraInterruttori() {
    INTERRUTTORI.forEach(function (id) { $(id).setAttribute("aria-pressed", stato[id]); });
  }

  // elenco di suggerimenti per il comune: nome che inizia con il testo scritto
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
      var bad = isNaN(n) || n < c[1] || n > c[2];
      el.setAttribute("aria-invalid", bad);
      err.hidden = !bad;
      err.textContent = bad ? c[3] + ": inserisci un valore tra " + num.format(c[1]) + " e " + num.format(c[2]) + "." : "";
      if (bad) ok = false; else v[id] = n;
    });
    if (ok && v.fd > v.f21) {
      $("fd").setAttribute("aria-invalid", true);
      $("fd-e").hidden = false;
      $("fd-e").textContent = "I figli disabili sono compresi nei figli a carico.";
      ok = false;
    }
    var codice = etichette[$("comune").value.trim().toUpperCase()];
    $("comune").setAttribute("aria-invalid", !codice);
    $("comune-e").hidden = !!codice;
    $("comune-e").textContent = codice ? "" : "Scegli un comune dall'elenco.";
    if (!codice) ok = false; else v.comune = codice;
    v.mensilita = Number(valoreRadio("mensilita"));
    v.quota = Number(valoreRadio("quota"));
    v.fondo = $("fondo").value;
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

  // cascata: parte dalla RAL, toglie o aggiunge ogni voce, arriva al netto
  function cascata(r) {
    var scala = r.ral, corrente = r.ral, html = riga("RAL", 0, r.ral, scala, "su", eur.format(r.ral));
    function meno(nome, x) {
      if (x < 0.005) return;
      html += riga(nome, corrente - x, corrente, scala, "giu", "−" + eur.format(x));
      corrente -= x;
    }
    meno("Contributi INPS", r.contributi);
    meno("Altre trattenute", r.trattenute);
    meno("IRPEF", r.irpef.netta);
    meno("Addizionale regionale", r.addizionali.regionale);
    meno("Addizionale comunale", r.addizionali.comunale);
    if (r.irpef.sommaEsente >= 0.005) {
      html += riga("Cuneo L. 207/24", corrente, corrente + r.irpef.sommaEsente, scala, "su", "+" + eur.format(r.irpef.sommaEsente));
    }
    return html + riga("Netto", 0, r.nettoAnnuo, scala, "tot", eur.format(r.nettoAnnuo), true);
  }

  function tabella(r) {
    var m = r.mensilita;
    function rg(nome, x, segno) {
      return "<tr><td>" + nome + "</td><td>" + (segno || "") + eur.format(x) + "</td><td>" + (segno || "") + eur.format(x / m) + "</td></tr>";
    }
    return '<table class="tabella"><thead><tr><th>Voce</th><th>Annuo</th><th>Su ' + m + " mensilità</th></tr></thead><tbody>" +
      rg("RAL", r.ral) +
      rg("Contributi INPS", r.contributi, "−") +
      rg("Imponibile fiscale", r.imponibileFiscale) +
      rg("IRPEF lorda", r.irpef.lorda) +
      rg("Detrazioni lavoro dipendente", r.irpef.detrazioni, "−") +
      rg("Ulteriore detrazione L. 207/24", r.irpef.ulterioreDetrazione, "−") +
      rg("Detrazioni familiari", r.irpef.detrazioniFamiliari, "−") +
      rg("IRPEF netta", r.irpef.netta) +
      rg("Addizionale regionale", r.addizionali.regionale) +
      rg("Addizionale comunale", r.addizionali.comunale) +
      rg("Somma esente L. 207/24", r.irpef.sommaEsente, "+") +
      rg("Altre trattenute", r.trattenute, "−") +
      rg("Netto", r.nettoAnnuo) + "</tbody></table>";
  }

  function opzioni(r) {
    var prelievo = r.ral - r.nettoAnnuo;
    var imposte = r.irpef.netta + r.addizionali.regionale + r.addizionali.comunale;
    var cuneo = r.irpef.sommaEsente + r.irpef.ulterioreDetrazione;
    var voci = [
      ["Netto annuo", eur.format(r.nettoAnnuo), "Pari a " + pct.format(r.nettoAnnuo / r.ral * 100) + "% della RAL", true],
      ["Contributi INPS", eur.format(r.contributi), pct.format(r.contributi / r.ral * 100) + "% della RAL", false],
      ["IRPEF e addizionali", eur.format(imposte), "IRPEF " + eur.format(r.irpef.netta) + " · addizionali " + eur.format(r.addizionali.regionale + r.addizionali.comunale), false],
      ["Prelievo complessivo", pct.format(prelievo / r.ral * 100) + "%", eur.format(prelievo) + " tra contributi, imposte e trattenute", false]
    ];
    if (cuneo >= 0.005) voci.splice(3, 0, ["Cuneo fiscale L. 207/24", eur.format(cuneo), r.irpef.sommaEsente > 0 ? "Somma esente in busta, non tassata" : "Ulteriore detrazione sull'IRPEF", false]);
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
      r = Busta.calcolaNetto(v.ral, {
        mensilita: v.mensilita,
        tempoDeterminato: stato.td,
        apprendista: stato.app,
        massimale: stato.mass,
        fondo: v.fondo,
        comune: v.comune,
        altreVoci: v.at > 0 ? [{descrizione: "Altre trattenute", importo: v.at, deducibile: false}] : [],
        deduzioni: {previdenzaComplementare: v.pl, previdenzaComplementareDitta: v.pd, assistenzaSanitaria: v.ps},
        familiari: {coniuge: stato.coniuge, figli21: v.f21 - v.fd, figliDisabili21: v.fd, altri: v.alt, quota: v.quota}
      });
    } catch (e) {
      box.classList.add("inattivo");
      $("avviso").innerHTML = '<p class="avviso">' + e.message + "</p>";
      return;
    }
    box.classList.remove("inattivo");
    var verifica = r.addizionali.daVerificare || [];
    $("avviso").innerHTML = verifica.length ?
      '<p class="avviso lieve">Dati del comune da verificare: ' + verifica.join(", ") + ".</p>" : "";

    $("delta").textContent = "RAL " + eur.format(v.ral) + " su " + v.mensilita + " mensilità";
    $("kpi").textContent = eur.format(r.nettoMensile);
    $("kpi-sub").textContent = "al mese · " + eur.format(r.nettoAnnuo) + " all'anno";
    $("opzioni").innerHTML = opzioni(r);
    $("rend").textContent = "Stima su base annua: in busta il singolo mese può differire di qualche euro.";
    $("sottotitolo-cascata").textContent = "Dalla RAL, voce per voce, fino al netto annuo.";
    $("cascata").innerHTML = cascata(r);
    $("tabella").innerHTML = tabella(r);
    $("mob-p").textContent = eur.format(r.nettoMensile);
    $("mob-delta").textContent = eur.format(r.nettoAnnuo) + "/anno";

    try {
      var p = new URLSearchParams();
      Object.keys(CAMPI).forEach(function (k) { if (v[k] !== CAMPI[k][0]) p.set(k, v[k]); });
      INTERRUTTORI.forEach(function (k) { if (stato[k]) p.set(k, 1); });
      if (v.mensilita !== 14) p.set("mensilita", v.mensilita);
      if (v.quota !== 1) p.set("quota", v.quota);
      if (v.fondo !== "nessuno") p.set("fondo", v.fondo);
      if (v.comune !== COMUNE_PREDEFINITO) p.set("comune", v.comune);
      history.replaceState(null, "", location.pathname + location.search + (p.toString() ? "#" + p : ""));
    } catch (e) {}
  }

  function imposta(o) {
    Object.keys(o).forEach(function (k) { $(k).value = o[k]; });
    aggiorna();
  }

  function ripristina() {
    Object.keys(CAMPI).forEach(function (k) { $(k).value = CAMPI[k][0]; });
    INTERRUTTORI.forEach(function (k) { stato[k] = false; });
    impostaRadio("mensilita", 14);
    impostaRadio("quota", 1);
    $("fondo").value = "nessuno";
    impostaComune(COMUNE_PREDEFINITO);
    mostraInterruttori();
    aggiorna();
  }

  // 4. eventi
  $("profilo").addEventListener("input", function (e) { if (e.target.id === "comune") suggerisci(); aggiorna(); });
  $("profilo").addEventListener("submit", function (e) { e.preventDefault(); });
  INTERRUTTORI.forEach(function (id) {
    $(id).addEventListener("click", function () { stato[id] = !stato[id]; mostraInterruttori(); aggiorna(); });
  });
  [].forEach.call(document.querySelectorAll("[data-contatore] button"), function (b) {
    b.addEventListener("click", function () {
      var el = b.parentNode.querySelector("input"), c = CAMPI[el.id];
      var n = parseFloat(el.value);
      el.value = Math.min(c[2], Math.max(c[1], (isNaN(n) ? 0 : n) + Number(b.dataset.passo)));
      aggiorna();
    });
  });
  [].forEach.call(document.querySelectorAll("[data-esempio]"), function (b) {
    b.addEventListener("click", function () { imposta({ral: Number(b.dataset.esempio)}); });
  });
  $("ripristina").addEventListener("click", ripristina);
  $("copia").addEventListener("click", function () {
    var btn = this, fatto = function () { btn.textContent = "Copiato"; setTimeout(function () { btn.textContent = "Copia link"; }, 1500); };
    try {
      navigator.clipboard.writeText(location.href).then(fatto, function () { btn.textContent = "Copia dalla barra"; });
    } catch (e) { btn.textContent = "Copia dalla barra"; }
  });

  // all'apertura: valori dal link, se ci sono
  try {
    new URLSearchParams(location.hash.slice(1)).forEach(function (val, k) {
      if (CAMPI[k]) $(k).value = val;
      else if (INTERRUTTORI.indexOf(k) >= 0) stato[k] = val === "1";
      else if (k === "mensilita" || k === "quota") impostaRadio(k, val);
      else if (k === "fondo" && $("fondo").querySelector('option[value="' + val + '"]')) $("fondo").value = val;
      else if (k === "comune") impostaComune(val);
    });
  } catch (e) {}
  if (!$("comune").value || !etichette[$("comune").value.toUpperCase()]) impostaComune(COMUNE_PREDEFINITO);
  mostraInterruttori();
  suggerisci();

  var dati = [["Anno fiscale", Busta.anno], ["IRPEF", "23% · 33% · 43%"], ["Cuneo fiscale", "L. 207/2024"],
    ["Comuni", num.format(Object.keys(window.COMUNI.comuni).length)]];
  $("dati-modello").innerHTML = dati.map(function (d) { return "<li>" + d[0] + " <b>" + d[1] + "</b></li>"; }).join("");

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (voci) {
      $("barra-mobile").classList.toggle("visibile", !voci[0].isIntersecting && voci[0].boundingClientRect.top > 0);
    }).observe($("risultato"));
  }
  aggiorna();
})();
