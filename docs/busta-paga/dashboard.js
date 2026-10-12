// INTERFACCIA: legge le caselle, usa Busta.calcolaNetto (script.js), scrive nella pagina.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var eur = new Intl.NumberFormat("it-IT", {style: "currency", currency: "EUR"});
  var pct = new Intl.NumberFormat("it-IT", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  var num = new Intl.NumberFormat("it-IT");
  var pct3 = new Intl.NumberFormat("it-IT", {maximumFractionDigits: 3});
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };

  // id: [predefinito, minimo, massimo, nome per l'errore]
  var CAMPI = {
    ral: [30000, 1000, 1e7, "RAL"],
    pl: [0, 0, 5000, "Previdenza complementare"],
    pd: [0, 0, 5000, "Previdenza complementare ditta"],
    ps: [0, 0, 5000, "Assistenza sanitaria"],
    f21: [0, 0, 10, "Figli a carico"],
    fd: [0, 0, 10, "Figli disabili"],
    alt: [0, 0, 10, "Altri familiari"]
  };
  var FAMIGLIA = ["coniuge", "f21", "fd", "alt", "quota"];   // se nel link, apro la sezione
  var UNITA = ["pl", "pd"];   // previdenza complementare: % della retribuzione o € al mese
  var MENS_PREDEFINITO = "2000";
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

  // "1500;200,50" -> 1700,5 (virgola = decimali, punto = migliaia); NaN se qualcosa non è un numero
  function sommaMensile(testo) {
    var parti = testo.split(";").map(function (p) { return p.trim(); }).filter(Boolean), tot = 0;
    for (var i = 0; i < parti.length; i++) {
      var p = parti[i];
      if (p.indexOf(",") >= 0 || /^\d{1,3}(\.\d{3})+$/.test(p)) p = p.replace(/\./g, "").replace(",", ".");
      var n = /^\d+(\.\d+)?$/.test(p) ? parseFloat(p) : NaN;
      if (isNaN(n)) return NaN;
      tot += n;
    }
    return parti.length ? tot : NaN;
  }

  function mostraModo() {
    var m = valoreRadio("modo") === "mensile";
    $("blocco-ral").hidden = m;
    $("blocco-mens").hidden = !m;
  }

  // altre voci: descrizione, valore, unità ("e" = €/mese, "p" = % dell'imponibile)
  function aggiungiVoce(d, t, v) {
    var riga = document.createElement("div");
    riga.className = "voce";
    riga.innerHTML = '<input type="text" class="v-d" placeholder="Es. Ebitermo" aria-label="Descrizione voce">' +
      '<input type="number" class="v-v" step="0.01" aria-label="Valore voce">' +
      '<select class="v-t" aria-label="Unità"><option value="e">€/mese</option><option value="p">%</option></select>' +
      '<button type="button" class="v-x" aria-label="Rimuovi voce">×</button>';
    riga.querySelector(".v-d").value = d || "";
    riga.querySelector(".v-v").value = v || 0;
    riga.querySelector(".v-t").value = t === "p" ? "p" : "e";
    $("voci").appendChild(riga);
  }

  function vociDaPagina() {
    return [].map.call(document.querySelectorAll(".voce"), function (r) {
      return [r.querySelector(".v-d").value, r.querySelector(".v-t").value, r.querySelector(".v-v").value];
    });
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
    var mensile = valoreRadio("modo") === "mensile";
    Object.keys(CAMPI).forEach(function (id) {
      if (id === "ral" && mensile) return;
      var c = CAMPI[id], el = $(id), err = $(id + "-e");
      var n = parseFloat(String(el.value).replace(",", "."));
      var max = UNITA.indexOf(id) >= 0 && $(id + "-u").value === "p" ? 100 : c[2];
      var bad = isNaN(n) || n < c[1] || n > max;
      el.setAttribute("aria-invalid", bad);
      err.hidden = !bad;
      err.textContent = bad ? c[3] + ": inserisci un valore tra " + num.format(c[1]) + " e " + num.format(max) + "." : "";
      if (bad) ok = false; else v[id] = n;
    });
    if (ok && v.fd > v.f21) {
      $("fd").setAttribute("aria-invalid", true);
      $("fd-e").hidden = false;
      $("fd-e").textContent = "I figli disabili sono compresi nei figli a carico.";
      ok = false;
    }
    v.mensilita = Number(valoreRadio("mensilita"));
    var m = sommaMensile($("mens").value), aiutoM = "Più cifre separate da «;» (es. 1500;200) si sommano.";
    if (mensile) {
      var cr = CAMPI.ral, badM = isNaN(m) || m * v.mensilita < cr[1] || m * v.mensilita > cr[2];
      $("mens").setAttribute("aria-invalid", badM);
      $("mens-e").hidden = !badM;
      $("mens-e").textContent = badM ? "Inserisci importi positivi separati da «;», per una RAL tra " + num.format(cr[1]) + " e " + num.format(cr[2]) + " €." : "";
      if (badM) ok = false; else v.ral = m * v.mensilita;
    }
    v.eur = {};
    UNITA.forEach(function (id) { v.eur[id] = v[id] === undefined ? 0 : $(id + "-u").value === "p" ? v[id] / 100 * v.ral / v.mensilita : v[id] * 12 / v.mensilita; });
    v.eur.ps = v.ps === undefined ? 0 : v.ps * 12 / v.mensilita;
    $("mens-aiuto").textContent = isNaN(m) ? aiutoM : "Totale " + eur.format(m) + " × " + v.mensilita + " = RAL " + eur.format(m * v.mensilita) + ". " + aiutoM;
    v.voci = []; v.vociUi = [];
    var badV = false;
    [].forEach.call(document.querySelectorAll(".voce"), function (r) {
      var iv = r.querySelector(".v-v"), t = r.querySelector(".v-t").value, n = parseFloat(String(iv.value).replace(",", "."));
      var bad = isNaN(n) || n < 0 || n > (t === "p" ? 100 : 10000);
      iv.setAttribute("aria-invalid", bad);
      if (bad) { badV = true; return; }
      if (n === 0) return;
      v.voci.push(Object.assign({descrizione: r.querySelector(".v-d").value.trim() || "Altra voce", deducibile: false}, t === "p" ? {aliquota: n / 100} : {importo: n * 12 / v.mensilita}));
      v.vociUi.push({t: t, n: n});
    });
    $("voci-e").hidden = !badV;
    $("voci-e").textContent = badV ? "Altre voci: valore tra 0 e 10.000 € (o 100 %)." : "";
    if (badV) ok = false;
    if (!ok && $("famiglia").querySelector("[aria-invalid=true]")) $("famiglia").open = true;
    var codice = etichette[$("comune").value.trim().toUpperCase()];
    $("comune").setAttribute("aria-invalid", !codice);
    $("comune-e").hidden = !!codice;
    $("comune-e").textContent = codice ? "" : "Scegli un comune dall'elenco.";
    if (!codice) ok = false; else v.comune = codice;
    v.quota = Number(valoreRadio("quota"));
    v.fondo = $("fondo").value;
    return ok ? v : null;
  }

  // 2. riga di una barra: parte da "da" e arriva ad "a", su una scala comune
  function riga(nome, da, a, scala, classe, testo, finale, sub) {
    var sinistra = Math.max(0, da) / scala * 100;
    var larghezza = Math.max(0, a - Math.max(0, da)) / scala * 100;
    return '<div class="riga' + (finale ? " estremo" : "") + '"><div class="nome"><b>' + nome +
      '</b>' + (sub ? "<span>" + sub + "</span>" : "") + '</div><div class="pista"><span class="seg ' + classe + '" style="left:' + sinistra +
      "%;width:" + larghezza + '%"></span></div><div class="val ' + classe + '">' + testo + "</div></div>";
  }

  var vociUi = [];   // unità e valore inseriti, nello stesso ordine di r.altreVoci
  function nomeFondo() { return "Fondo " + esc($("fondo").selectedOptions[0].text.split(",")[0]); }
  var versUi = {t: "p", n: 0};   // unità e valore della previdenza complementare
  function sub(importo, u, r, base) {
    var p = u && u.t === "p";
    return pct3.format(p ? u.n : importo / r.ral * 100) + (p ? "% " + base : "% della RAL");
  }
  function subVoce(x, i, r) { return sub(x.importo, vociUi[i], r, "dell'imponibile"); }
  function subPrev(r) { return sub(r.versamenti.previdenza, versUi, r, "della retribuzione"); }

  // cascata: parte dalla RAL, toglie o aggiunge ogni voce, arriva al netto
  function cascata(r) {
    var scala = r.ral, corrente = r.ral, html = riga("RAL", 0, r.ral, scala, "su", eur.format(r.ral));
    function meno(nome, x, sub) {
      if (x < 0.005) return;
      html += riga(nome, corrente - x, corrente, scala, "giu", "−" + eur.format(x), false, sub);
      corrente -= x;
    }
    meno("Contributi INPS", r.contributi - r.fondo.importo);
    meno(nomeFondo(), r.fondo.importo, pct3.format(r.fondo.aliquota * 100) + "%");
    meno("Previdenza complementare", r.versamenti.previdenza, subPrev(r));
    meno("Assistenza sanitaria", r.versamenti.sanita);
    r.altreVoci.forEach(function (x, i) { meno(esc(x.descrizione), x.importo, subVoce(x, i, r)); });
    meno("IRPEF", r.irpef.netta);
    meno("Addizionale regionale", r.addizionali.regionale);
    meno("Addizionale comunale", r.addizionali.comunale);
    if (r.irpef.sommaEsente >= 0.005) {
      html += riga("Cuneo L. 207/24", corrente, corrente + r.irpef.sommaEsente, scala, "su", "+" + eur.format(r.irpef.sommaEsente));
    }
    return html + riga("Netto", 0, r.nettoAnnuo, scala, "tot", eur.format(r.nettoAnnuo), true);
  }

  // annuo, mese ordinario (media dei 12 mesi) e mensilità extra (13ª, 14ª: ciascuna)
  function tabella(r) {
    var m = r.mensilita, vers = r.versamenti, righe = r.mesi.righe;
    var ord = righe.slice(0, 12), ext = righe.slice(12), conExtra = ext.length > 0;
    function media(lista, f) { return lista.length ? lista.reduce(function (t, x) { return t + f(x); }, 0) / lista.length : 0; }
    function cella(x, segno) { return "<td>" + (x >= 0.005 ? (segno || "") + eur.format(x) : "–") + "</td>"; }
    // pm: {o, e} per le voci che non sono uguali su tutti i pagamenti; altrimenti annuo / mensilità
    function rg(nome, x, segno, forte, pm) {
      if (segno && x < 0.005) return "";   // niente righe a zero
      pm = pm || {o: x / m, e: x / m};
      return "<tr" + (forte ? ' class="tot"' : "") + "><td>" + nome + "</td>" + cella(x, segno) + cella(pm.o, segno) + (conExtra ? cella(pm.e, segno) : "") + "</tr>";
    }
    function solo12(x) { return {o: x / 12, e: 0}; }   // detrazioni e addizionali: solo sui 12 mesi ordinari
    function sez(titolo) { return '<tr class="sez"><th colspan="' + (conExtra ? 4 : 3) + '">' + titolo + "</th></tr>"; }
    var totale = r.altreVoci.reduce(function (t, x) { return t + x.importo; }, r.contributi + vers.previdenza + vers.sanita);
    var nettaOrd = media(ord, function (x) { return x.irpefLorda - x.detrazioni; });
    var etichettaExtra = ext.length > 1 ? ext.map(function (x) { return x.nome.replace(" mensilità", ""); }).join(" e ") + ", ciascuna" : conExtra ? ext[0].nome : "";

    return '<div class="scorri"><table class="tabella"><thead><tr><th>Voce</th><th>Annuo</th><th>Mese ordinario<br><small>media sui 12 mesi</small></th>' +
      (conExtra ? "<th>Mensilità extra<br><small>" + etichettaExtra + "</small></th>" : "") + "</tr></thead><tbody>" +
      sez("Retribuzione") +
      rg("RAL", r.ral, "", true) +
      sez("Contributi e trattenute") +
      rg("Contributi INPS", r.contributi - r.fondo.importo, "−") +
      (r.fondo.importo >= 0.005 ? rg(nomeFondo() + " (" + pct3.format(r.fondo.aliquota * 100) + "%)", r.fondo.importo, "−") : "") +
      (vers.previdenza >= 0.005 ? rg("Previdenza complementare (" + subPrev(r) + ")", vers.previdenza, "−") : "") +
      (vers.sanita >= 0.005 ? rg("Assistenza sanitaria", vers.sanita, "−") : "") +
      r.altreVoci.map(function (x, i) { return rg(esc(x.descrizione) + " (" + subVoce(x, i, r) + ")", x.importo, "−"); }).join("") +
      rg("Totale contributi e trattenute", totale, "−", true) +
      sez("IRPEF") +
      rg("Imponibile fiscale", r.imponibileFiscale) +
      rg("IRPEF lorda", r.irpef.lorda) +
      rg("Detrazioni lavoro dipendente", r.irpef.detrazioni, "−", false, solo12(r.irpef.detrazioni)) +
      rg("Ulteriore detrazione L. 207/24", r.irpef.ulterioreDetrazione, "−", false, solo12(r.irpef.ulterioreDetrazione)) +
      rg("Detrazioni familiari", r.irpef.detrazioniFamiliari, "−", false, solo12(r.irpef.detrazioniFamiliari)) +
      rg("IRPEF netta", r.irpef.netta, "", true, {o: nettaOrd, e: media(ext, function (x) { return x.irpefLorda - x.detrazioni; })}) +
      rg("Addizionale regionale", r.addizionali.regionale, "−", false, solo12(r.addizionali.regionale)) +
      rg("Addizionale comunale", r.addizionali.comunale, "−", false, solo12(r.addizionali.comunale)) +
      rg("Somma esente L. 207/24", r.irpef.sommaEsente, "+") +
      sez("Netto") +
      rg("Netto", r.nettoAnnuo, "", true, {o: media(ord, function (x) { return x.netto; }), e: media(ext, function (x) { return x.netto; })}) +
      "</tbody></table></div>";
  }

  // una riga per pagamento: 12 mesi + 13ª e 14ª
  function mesi(r) {
    var righe = r.mesi.righe, tot = {};
    ["lordo", "trattenute", "irpefLorda", "detrazioni", "regionale", "comunale", "sommaEsente", "netto"].forEach(function (k) {
      tot[k] = righe.reduce(function (t, x) { return t + x[k]; }, 0);
    });
    // colonne: chiave, intestazione, nome completo, segno (− toglie dal netto, + aggiunge); il cuneo compare solo se c'è
    var colonne = [
      ["lordo", "Lordo", "Retribuzione lorda", ""],
      ["trattenute", "Trattenute", "Contributi INPS, fondo, previdenza, sanità e altre voci", "−"],
      ["irpefLorda", "IRPEF", "IRPEF lorda", "−"],
      ["detrazioni", "Detrazioni", "Detrazioni lavoro dipendente, L. 207/24 e familiari", "+"],
      ["regionale", "Add. reg.", "Addizionale regionale", "−"],
      ["comunale", "Add. com.", "Addizionale comunale", "−"],
      ["sommaEsente", "Cuneo", "Somma esente L. 207/24", "+"]
    ].filter(function (c) { return c[0] !== "sommaEsente" || tot.sommaEsente >= 0.005; });
    function riga(nome, x, classe) {
      return "<tr" + (classe ? ' class="' + classe + '"' : "") + "><td>" + nome + "</td>" +
        colonne.map(function (c) { return "<td>" + (x[c[0]] >= 0.005 ? c[3] + eur.format(x[c[0]]) : "–") + "</td>"; }).join("") +
        "<td><b>" + eur.format(x.netto) + "</b></td></tr>";
    }
    var nota = "Detrazioni (lavoro, L. 207/24, familiari) e addizionali si applicano ai 12 mesi ordinari: " +
      (righe.length > 12 ? "la " + righe.slice(12).map(function (x) { return x.nome.replace(" mensilità", ""); }).join(" e la ") + " pagano l'IRPEF piena. " : "") +
      "Addizionali in 11 rate da gennaio (acconto comunale in 9 rate da marzo), quindi a dicembre non ci sono.";
    if (Math.abs(r.mesi.conguaglio) >= 1) nota += " A dicembre c'è un conguaglio IRPEF di " + eur.format(r.mesi.conguaglio) + ": le detrazioni superano l'imposta di un mese.";
    return '<div class="scorri"><table class="tabella larga"><thead><tr><th>Mensilità</th>' + colonne.map(function (c) { return '<th title="' + c[2] + '">' + c[1] + "</th>"; }).join("") + '<th>Netto</th></tr></thead><tbody>' +
      righe.map(function (x) { return riga(x.nome, x, x.aggiuntiva ? "agg" : ""); }).join("") +
      '<tr class="vuoto"><td colspan="' + (colonne.length + 2) + '"></td></tr>' +
      riga("Totale", tot, "tot") + '</tbody></table></div><p class="nota">' + nota + "</p>";
  }

  function opzioni(r) {
    var prelievo = r.ral - r.nettoAnnuo;
    var imposte = r.irpef.netta + r.addizionali.regionale + r.addizionali.comunale;
    var cuneo = r.irpef.sommaEsente + r.irpef.ulterioreDetrazione;
    var voci = [
      ["Netto annuo", eur.format(r.nettoAnnuo), "Pari a " + pct.format(r.nettoAnnuo / r.ral * 100) + "% della RAL", true],
      ["Contributi INPS", eur.format(r.contributi), pct.format(r.contributi / r.ral * 100) + "% della RAL" + (r.fondo.importo >= 0.005 ? " · di cui fondo " + eur.format(r.fondo.importo) : ""), false],
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
    mostraModo();
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
        altreVoci: v.voci,
        deduzioni: {previdenzaComplementare: v.eur.pl, previdenzaComplementareDitta: v.eur.pd, assistenzaSanitaria: v.eur.ps},
        familiari: {coniuge: stato.coniuge, figli21: v.f21 - v.fd, figliDisabili21: v.fd, altri: v.alt, quota: v.quota}
      });
    } catch (e) {
      box.classList.add("inattivo");
      $("avviso").innerHTML = '<p class="avviso">' + e.message + "</p>";
      return;
    }
    vociUi = v.vociUi;
    versUi = {t: $("pl-u").value, n: v.pl};
    box.classList.remove("inattivo");
    var verifica = r.addizionali.daVerificare || [];
    $("avviso").innerHTML = verifica.length ?
      '<p class="avviso lieve">Dati del comune da verificare: ' + verifica.join(", ") + ".</p>" : "";

    $("riepilogo").textContent = eur.format(v.ral) + " · " + v.mensilita + " mensilità · " + $("comune").value +
      (v.fondo !== "nessuno" ? " · " + $("fondo").selectedOptions[0].text.split(",")[0] : "");
    $("delta").textContent = "RAL " + eur.format(v.ral) + " su " + v.mensilita + " mensilità";
    $("kpi").textContent = eur.format(r.nettoMensile);
    $("kpi-sub").textContent = "in media al mese · " + eur.format(r.nettoAnnuo) + " all'anno";
    $("kpi-mesi").textContent = r.mesi.righe.length > 12 ?
      "Mese ordinario " + eur.format(r.mesi.righe[2].netto) + " · " + r.mesi.righe.slice(12).map(function (x) { return x.nome.replace(" mensilità", "") + " " + eur.format(x.netto); }).join(" · ") : "";
    $("opzioni").innerHTML = opzioni(r);
    $("mesi").innerHTML = mesi(r);
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
      UNITA.forEach(function (k) { if ($(k + "-u").value !== "p") p.set(k + "u", "e"); });
      if (valoreRadio("modo") === "mensile") { p.set("modo", "mensile"); p.set("mens", $("mens").value); }
      if (vociDaPagina().length) p.set("voci", JSON.stringify(vociDaPagina()));
      if (v.mensilita !== 14) p.set("mensilita", v.mensilita);
      if (v.quota !== 1) p.set("quota", v.quota);
      if (v.fondo !== "nessuno") p.set("fondo", v.fondo);
      if (v.comune !== COMUNE_PREDEFINITO) p.set("comune", v.comune);
      history.replaceState(null, "", location.pathname + location.search + (p.toString() ? "#" + p : ""));
    } catch (e) {}
  }

  // "Calcola il netto": se i dati sono validi mostro il risultato e comprimo l'inserimento
  function invia(fermo) {
    if (!leggi()) {
      var bad = document.querySelector("#profilo [aria-invalid=true]");
      if (bad) bad.focus();
      return;
    }
    aggiorna();
    $("esito").hidden = false;
    $("dati").open = false;
    if (!fermo) $("dati").scrollIntoView({behavior: "smooth"});
  }

  function ripristina() {
    if (!confirm("Cancellare tutti i dati inseriti e ricominciare?")) return;
    Object.keys(CAMPI).forEach(function (k) { $(k).value = CAMPI[k][0]; });
    $("voci").innerHTML = "";
    $("mens").value = MENS_PREDEFINITO;
    UNITA.forEach(function (k) { $(k + "-u").value = "p"; });
    $("famiglia").open = false;
    $("esito").hidden = true;
    $("dati").open = true;
    impostaRadio("modo", "ral");
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
  $("profilo").addEventListener("submit", function (e) { e.preventDefault(); invia(); });
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
  $("aggiungi-voce").addEventListener("click", function () { aggiungiVoce(); aggiorna(); $("voci").lastChild.querySelector(".v-d").focus(); });
  $("voci").addEventListener("click", function (e) {
    if (e.target.classList.contains("v-x")) { e.target.parentNode.remove(); aggiorna(); }
  });
  // schede sotto il risultato: una alla volta, un secondo clic la richiude
  var schede = [].slice.call(document.querySelectorAll(".scheda-tab"));
  schede.forEach(function (t) {
    t.addEventListener("click", function () {
      var apri = t.getAttribute("aria-selected") !== "true";
      schede.forEach(function (x) {
        var su = apri && x === t;
        x.setAttribute("aria-selected", su);
        $(x.getAttribute("aria-controls")).hidden = !su;
      });
    });
  });
  [].forEach.call(document.querySelectorAll(".ripristina"), function (b) { b.addEventListener("click", ripristina); });

  // all'apertura: valori dal link, se ci sono
  try {
    new URLSearchParams(location.hash.slice(1)).forEach(function (val, k) {
      if (FAMIGLIA.indexOf(k) >= 0) $("famiglia").open = true;
      if (CAMPI[k]) $(k).value = val;
      else if (k === "mens") $("mens").value = val;
      else if (k === "plu" || k === "pdu") $(k.slice(0, 2) + "-u").value = val === "e" ? "e" : "p";
      else if (k === "voci") JSON.parse(val).forEach(function (x) { aggiungiVoce(x[0], x[1], x[2]); });
      else if (INTERRUTTORI.indexOf(k) >= 0) stato[k] = val === "1";
      else if (k === "mensilita" || k === "quota" || k === "modo") impostaRadio(k, val);
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
  if (location.hash.length > 1) invia(true);   // link condiviso: subito il risultato
})();
