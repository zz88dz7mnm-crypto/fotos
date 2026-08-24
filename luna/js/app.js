/* app.js — estado, panel de datos, linea de tiempo e interacciones. */
(function () {
  'use strict';

  var A = window.LunaAstro, FEAT = window.LUNA_FEATURES;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'luna-real:v1';
  var MOON_R_KM = 1737.4, MEAN_KM = 384400;
  var RANGE_DAYS = 33, BACK_DAYS = 2, STEP_MIN = 5;

  var PLACES = [
    { n: 'Buenos Aires', lat: -34.60, lon: -58.38 },
    { n: 'Córdoba', lat: -31.42, lon: -64.18 },
    { n: 'Rosario', lat: -32.95, lon: -60.66 },
    { n: 'Mendoza', lat: -32.89, lon: -68.84 },
    { n: 'Bariloche', lat: -41.13, lon: -71.31 },
    { n: 'Ushuaia', lat: -54.80, lon: -68.30 },
    { n: 'Montevideo', lat: -34.90, lon: -56.16 },
    { n: 'Santiago de Chile', lat: -33.45, lon: -70.67 },
    { n: 'Lima', lat: -12.05, lon: -77.04 },
    { n: 'Bogotá', lat: 4.71, lon: -74.07 },
    { n: 'Ciudad de México', lat: 19.43, lon: -99.13 },
    { n: 'Madrid', lat: 40.42, lon: -3.70 },
    { n: 'Barcelona', lat: 41.39, lon: 2.17 },
    { n: 'Nueva York', lat: 40.71, lon: -74.01 },
    { n: 'Londres', lat: 51.51, lon: -0.13 },
    { n: 'Tokio', lat: 35.68, lon: 139.69 }
  ];

  var state = {
    timeA: new Date(),
    timeB: null,
    slot: 'a',
    lat: PLACES[0].lat, lon: PLACES[0].lon, place: PLACES[0].n,
    obs: null,
    upMode: 'zenith',
    labels: false,
    compare: false,
    playing: false,
    speed: 0.22,             // dias por segundo
    start: null,
    snap: null, snapB: null
  };

  /* ---------- formato ---------- */
  var LOC = 'es-AR';
  function mk(opts) {
    try { return new Intl.DateTimeFormat(LOC, opts); }
    catch (e) { return { format: function (d) { return d.toString().slice(0, 24); } }; }
  }
  var fT = mk({ hour: '2-digit', minute: '2-digit', hour12: false });
  var fD = mk({ weekday: 'short', day: 'numeric', month: 'short' });
  var fDY = mk({ day: 'numeric', month: 'short', year: 'numeric' });
  var fFull = mk({ weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
  var fW = mk({ weekday: 'short' });
  function num(v, d) {
    try { return v.toLocaleString(LOC, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
    catch (e) { return v.toFixed(d || 0); }
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function deg(v, d) { return num(v, d === undefined ? 1 : d) + '°'; }
  function hhmm(d) { return d ? fT.format(d) : '—'; }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

  /* ---------- persistencia ---------- */
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        lat: state.lat, lon: state.lon, place: state.place,
        upMode: state.upMode, labels: state.labels
      }));
    } catch (e) { /* modo privado: no pasa nada */ }
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s.lat === 'number') {
        state.lat = s.lat; state.lon = s.lon; state.place = s.place || 'Personalizada';
        state.upMode = s.upMode === 'north' ? 'north' : 'zenith';
        state.labels = !!s.labels;
      }
    } catch (e) { /* idem */ }
  }

  /* ---------- tiempo activo ---------- */
  function activeTime() { return state.compare && state.slot === 'b' ? state.timeB : state.timeA; }
  function setActiveTime(d) {
    if (state.compare && state.slot === 'b') state.timeB = d; else state.timeA = d;
  }

  function midnight(d) { var x = new Date(d.getTime()); x.setHours(0, 0, 0, 0); return x; }
  function buildRange(anchor) {
    state.start = midnight(addDays(anchor, -BACK_DAYS));
    var scrub = $('scrub');
    scrub.max = String(RANGE_DAYS * 24 * 60 / STEP_MIN);
    buildDays();
  }
  function inRange(d) {
    var off = (d - state.start) / 60000;
    return off >= 0 && off <= RANGE_DAYS * 24 * 60;
  }

  /* ---------- escena ---------- */
  var scene = null, hovering = null;

  /* La Luna se corre para no quedar tapada por el panel ni por la linea de
     tiempo: se centra en el hueco que realmente queda libre. */
  function layout() {
    if (!scene) return;
    var W = window.innerWidth, H = window.innerHeight;
    var tl = $('timeline'), bottom = tl ? tl.offsetHeight + 24 : 190;
    var top = 56;
    var fy = (top + bottom) / 2 / (H / 2) - bottom / (H / 2);
    fy = (bottom - top) / H;
    if (state.compare) {
      var inset = W > 900 ? 362 : 0;
      scene.setCompareInset(inset);
      document.documentElement.style.setProperty('--split-x', ((W - inset) / 2) + 'px');
      scene.setViewCenter(0, Math.min(0.22, fy));
      scene.setFill(W < 760 ? 0.30 : 0.40);
    } else {
      var panelW = (W > 900 && !document.body.classList.contains('sheet')) ? 362 : 0;
      scene.setViewCenter(-panelW / W, Math.min(0.26, fy));
      scene.setFill(null);
    }
  }

  function snapshotOf(date, light) {
    return A.snapshot(date, state.obs, state.upMode, { riseSet: !light });
  }

  /* ---------- panel ---------- */
  function cell(k, v, sub) {
    return '<div class="cell"><div class="k">' + k + '</div><div class="v">' + v +
      (sub ? ' <small>' + sub + '</small>' : '') + '</div></div>';
  }

  function renderPanel(s) {
    $('phase-name').textContent = s.phase.name;
    $('phase-when').textContent = cap(fFull.format(s.date));
    $('illum').textContent = num(s.illum * 100, s.illum * 100 < 9.95 ? 1 : 0);
    $('illum-bar').style.width = (s.illum * 100).toFixed(1) + '%';
    $('age').textContent = 'día ' + num(s.age, 1) + ' de ' + num(A.SYNODIC, 1) + ' · ' +
      (s.waxing ? 'creciendo' : 'menguando');

    var dPct = (s.distKm - MEAN_KM) / MEAN_KM * 100;
    $('stats').innerHTML =
      cell('Distancia', num(s.distKm) + ' km', (dPct >= 0 ? '+' : '−') + num(Math.abs(dPct), 1) + '%') +
      cell('Tamaño aparente', num(s.diamDeg, 3) + '°', 'de arco') +
      cell('Libración', deg(Math.abs(s.libLon)) + (s.libLon >= 0 ? ' E' : ' O'),
        deg(Math.abs(s.libLat)) + (s.libLat >= 0 ? ' N' : ' S')) +
      cell('Elongación', deg(s.elongation, 0), 'del Sol') +
      cell('Magnitud', num(s.magnitude, 1), 'aparente') +
      cell('Edad', num(s.age, 1) + ' d', 'de la lunación');

    var badges = [];
    if (s.supermoon) badges.push('<span class="badge warm">Superluna</span>');
    if (s.micromoon) badges.push('<span class="badge">Microluna</span>');
    if (ecl && ecl.lunar && sameDay(ecl.lunar.date, s.date))
      badges.push('<span class="badge hot">Eclipse de Luna hoy</span>');
    if (Math.abs(s.libLon) > 6.5)
      badges.push('<span class="badge">Libración fuerte: se asoma el limbo ' + (s.libLon > 0 ? 'este' : 'oeste') + '</span>');
    $('badges').innerHTML = badges.join('');

    /* --- cielo local --- */
    $('place-name').textContent = state.place;
    var alt = s.altitude, up = alt !== null && alt > 0;
    var sky = '';
    sky += cell('Altura', alt === null ? '—' : deg(alt), up ? 'sobre el horizonte' : 'bajo el horizonte');
    sky += cell('Azimut', s.azimuth === null ? '—' : deg(s.azimuth, 0), s.azimuth === null ? '' : compass(s.azimuth));
    sky += cell('Sale', hhmm(s.rise), 'hora local');
    sky += cell('Se pone', hhmm(s.set), 'hora local');
    $('sky').innerHTML = sky;
    $('hemi-note').textContent = state.upMode === 'zenith'
      ? 'Vista desde tu ubicación: la Luna aparece girada como se la ve en el ' +
        (state.lat < 0 ? 'hemisferio sur' : 'hemisferio norte') + '.'
      : 'Vista geocéntrica con el norte celeste arriba (como en los atlas).';
  }

  function compass(az) {
    var dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    return dirs[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
  }

  /* ---------- proximas fases ---------- */
  function renderQuarters() {
    var qs = A.quarters(new Date(), 4);
    var html = qs.map(function (q, i) {
      return '<li><span class="lk"><canvas class="qc" data-i="' + i + '" width="34" height="34" ' +
        'style="width:17px;height:17px"></canvas>' + q.name + '</span>' +
        '<span class="lv">' + cap(fD.format(q.date)) + ' <em>' + hhmm(q.date) +
        (q.supermoon ? ' · superluna' : q.micromoon ? ' · microluna' : '') + '</em></span></li>';
    }).join('');
    $('quarters').innerHTML = html;
    qs.forEach(function (q, i) {
      var c = $('quarters').querySelector('canvas[data-i="' + i + '"]');
      if (c) window.LunaDisc.draw(c, snapshotOf(q.date, true), { pad: 1 });
    });
  }

  var ecl = null;
  function renderEclipses() {
    ecl = A.eclipses(new Date(), state.obs);
    var items = [];
    if (ecl.lunar) {
      var l = ecl.lunar;
      var vis = l.visible === null ? '' : (l.visible
        ? 'visible desde ' + state.place + ' (' + deg(l.altitude, 0) + ' de altura)'
        : 'no visible desde ' + state.place);
      items.push('<li><span class="lk"><span class="dot">🌘</span>Eclipse ' + l.kind + ' de Luna</span>' +
        '<span class="lv">' + cap(fDY.format(l.date)) + ' <em>' + hhmm(l.date) + ' · ' + vis + '</em></span></li>');
    }
    if (ecl.solar) {
      var s = ecl.solar;
      var det = s.local
        ? (s.obscuration > 0.995 ? 'total desde tu ubicación'
          : num(s.obscuration * 100, 0) + '% del Sol cubierto desde ' + state.place)
        : 'franja central en ' + num(Math.abs(s.lat), 1) + '°' + (s.lat >= 0 ? 'N' : 'S') + ' ' +
          num(Math.abs(s.lon), 1) + '°' + (s.lon >= 0 ? 'E' : 'O');
      items.push('<li><span class="lk"><span class="dot">🌞</span>Eclipse ' + s.kind + ' de Sol</span>' +
        '<span class="lv">' + cap(fDY.format(s.date)) + ' <em>' + hhmm(s.date) + ' · ' + det + '</em></span></li>');
    }
    $('eclipses').innerHTML = items.join('') || '<li><span class="lk">Sin datos</span></li>';
  }

  /* ---------- linea de tiempo ---------- */
  var dayCells = [], stripTOD = -1;

  function buildDays() {
    var host = $('days');
    host.innerHTML = '';
    dayCells = [];
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = 40;
    for (var i = 0; i < RANGE_DAYS; i++) {
      var d = addDays(state.start, i);
      var el = document.createElement('button');
      el.className = 'day';
      el.dataset.i = String(i);
      var c = document.createElement('canvas');
      c.width = size * dpr; c.height = size * dpr;
      c.style.width = size + 'px'; c.style.height = size + 'px';
      el.appendChild(c);
      var meta = document.createElement('div');
      meta.innerHTML = '<div class="dw"></div><div class="dnum"></div><div class="dpc"></div><div class="dev"></div>';
      el.appendChild(meta);
      host.appendChild(el);
      dayCells.push({ el: el, canvas: c, date: d });
    }
    stripTOD = -1;
    updateDays(true);
  }

  function eventFor(date, snap) {
    if (ecl && ecl.lunar && sameDay(ecl.lunar.date, date)) return { t: 'Eclipse', ecl: true };
    if (ecl && ecl.solar && sameDay(ecl.solar.date, date)) return { t: 'Eclipse ☉', ecl: true };
    var k = snap.phase.key;
    if (k === 'new') return { t: 'Nueva' };
    if (k === 'full') return { t: snap.supermoon ? 'Superluna' : 'Llena' };
    if (k === 'first') return { t: 'C. crec.' };
    if (k === 'last') return { t: 'C. meng.' };
    return null;
  }

  function updateDays(force) {
    var t = activeTime();
    var tod = t.getHours() * 60 + t.getMinutes();
    if (!force && Math.abs(tod - stripTOD) < 20) return;
    stripTOD = tod;
    dayCells.forEach(function (c) {
      var d = new Date(c.date.getTime());
      d.setHours(t.getHours(), t.getMinutes(), 0, 0);
      var s = snapshotOf(d, true);
      c.snap = s;
      window.LunaDisc.draw(c.canvas, s, { pad: 2 });
      var ev = eventFor(d, s);
      var q = c.el.querySelector('.dw'), n = c.el.querySelector('.dnum'),
        p = c.el.querySelector('.dpc'), e = c.el.querySelector('.dev');
      q.textContent = fW.format(d).replace(/\.$/, '');
      n.textContent = d.getDate();
      p.textContent = num(s.illum * 100, 0) + '%';
      e.textContent = ev ? ev.t : '';
      e.className = 'dev' + (ev && ev.ecl ? ' ecl' : '');
      c.el.classList.toggle('today', sameDay(d, new Date()));
    });
    markSelectedDay();
  }

  function markSelectedDay() {
    var t = activeTime();
    dayCells.forEach(function (c) {
      c.el.classList.toggle('sel', sameDay(c.date, t));
    });
  }

  function scrollToSelected() {
    var t = activeTime();
    for (var i = 0; i < dayCells.length; i++) {
      if (sameDay(dayCells[i].date, t)) {
        var el = dayCells[i].el, host = $('days');
        host.scrollTo({ left: el.offsetLeft - host.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
        return;
      }
    }
  }

  /* ---------- etiquetas 3D ---------- */
  var labelEls = [];
  function buildLabels() {
    var host = $('labels');
    host.innerHTML = '';
    labelEls = FEAT.map(function (f) {
      var d = document.createElement('div');
      d.className = 'flabel ' + f.t;
      d.innerHTML = '<span class="pin"></span><span>' + f.n + '</span>';
      d.style.display = 'none';
      host.appendChild(d);
      return d;
    });
  }

  function updateLabels() {
    if (!scene) return;
    if (!state.labels || state.compare) {
      for (var i = 0; i < labelEls.length; i++) labelEls[i].style.display = 'none';
      return;
    }
    var boxes = [];
    var order = FEAT.map(function (f, i) { return i; }).sort(function (a, b) {
      return FEAT[b].d - FEAT[a].d;
    });
    var shown = {};
    for (var k = 0; k < order.length; k++) {
      var i2 = order[k], f = FEAT[i2], el = labelEls[i2];
      var p = scene.project(f.lon, f.lat);
      if (p.facing < 0.14 || p.x < 40 || p.y < 60 ||
          p.x > window.innerWidth - 40 || p.y > window.innerHeight - 150) {
        el.style.display = 'none'; continue;
      }
      var w = 16 + f.n.length * 5.6, h = 15;
      var box = [p.x - w / 2, p.y - h / 2, p.x + w / 2, p.y + h / 2];
      var clash = false;
      for (var b = 0; b < boxes.length; b++) {
        var o = boxes[b];
        if (box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]) { clash = true; break; }
      }
      if (clash) { el.style.display = 'none'; continue; }
      boxes.push(box);
      shown[i2] = 1;
      var fade = Math.min(1, (p.facing - 0.14) / 0.24);
      el.style.display = 'flex';
      el.style.transform = 'translate(' + (p.x - w / 2 + 6) + 'px,' + (p.y - h / 2) + 'px)';
      el.style.opacity = String(fade * (p.sunlit > 0 ? 1 : 0.5));
    }
  }

  /* ---------- picking ---------- */
  function angDist(lon1, lat1, lon2, lat2) {
    var r = Math.PI / 180;
    var a = A.lonLatToBody(lon1, lat1), b = A.lonLatToBody(lon2, lat2);
    var d = a.x * b.x + a.y * b.y + a.z * b.z;
    return Math.acos(Math.max(-1, Math.min(1, d))) / r;
  }
  function featureAt(lon, lat) {
    var best = null, bestRatio = 1e9;
    for (var i = 0; i < FEAT.length; i++) {
      var f = FEAT[i];
      var radius = Math.max(3.2, Math.min(20, (f.d / 2) / MOON_R_KM * 180 / Math.PI));
      var ratio = angDist(lon, lat, f.lon, f.lat) / radius;
      if (ratio < 1 && ratio < bestRatio) { bestRatio = ratio; best = f; }
    }
    return best;
  }
  var KIND = { crater: 'Cráter', mare: 'Mar lunar', basin: 'Cuenca de impacto', landing: 'Sitio de alunizaje' };
  function showFeature(f, hit) {
    var card = $('feature-card');
    if (!f && !hit) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    if (f) {
      $('feature-kind').textContent = (KIND[f.t] || '') + (Math.abs(f.lon) > 90 ? ' · cara oculta' : '');
      $('feature-name').textContent = f.n;
      $('feature-coords').textContent = fmtSeleno(f.lat, f.lon) +
        (f.d >= 40 ? '  ·  ⌀ ' + num(f.d) + ' km' : '');
      $('feature-text').textContent = f.x;
    } else {
      $('feature-kind').textContent = 'Superficie' + (Math.abs(hit.lon) > 90 ? ' · cara oculta' : '');
      $('feature-name').textContent = 'Sin accidente catalogado';
      $('feature-coords').textContent = fmtSeleno(hit.lat, hit.lon);
      $('feature-text').textContent = 'Coordenadas selenográficas del punto donde tocaste. ' +
        'Probá con los mares oscuros o con los cráteres grandes.';
    }
  }
  function fmtSeleno(lat, lon) {
    return num(Math.abs(lat), 1) + '° ' + (lat >= 0 ? 'N' : 'S') + '   ' +
      num(Math.abs(lon), 1) + '° ' + (lon >= 0 ? 'E' : 'O');
  }

  /* ---------- refresco ---------- */
  var heavyTimer = null;
  function refresh(light) {
    var tA = state.timeA;
    state.snap = snapshotOf(tA, light);
    if (state.compare) {
      state.snapB = snapshotOf(state.timeB, light);
      scene && scene.setCompare(state.snap, state.snapB);
    } else if (scene) {
      scene.setCompare(null, null);
    }
    var act = state.compare && state.slot === 'b' ? state.snapB : state.snap;
    if (scene) scene.setSnapshot(act);
    renderPanel(act);
    updateStamp();
    updateChips();
    updateDays(false);
    markSelectedDay();
    syncScrub();
    if (light) {
      clearTimeout(heavyTimer);
      heavyTimer = setTimeout(function () { refresh(false); }, 220);
    }
  }

  function updateStamp() {
    var t = activeTime();
    var isToday = sameDay(t, new Date());
    $('stamp').textContent = (isToday ? 'hoy · ' : '') + cap(fD.format(t)) + ' · ' + hhmm(t);
  }
  function updateChips() {
    if (!state.compare) return;
    $('chip-a').textContent = cap(fD.format(state.timeA)) + ' · ' + num(state.snap.illum * 100, 0) + '%';
    $('chip-b').textContent = cap(fD.format(state.timeB)) + ' · ' + num(state.snapB.illum * 100, 0) + '%';
  }
  function syncScrub() {
    var t = activeTime();
    if (!inRange(t)) { buildRange(t); }
    $('scrub').value = String(Math.round((t - state.start) / 60000 / STEP_MIN));
  }

  /* ---------- ubicacion ---------- */
  function applyLocation(lat, lon, name) {
    state.lat = lat; state.lon = lon; state.place = name || 'Personalizada';
    state.obs = A.observer(lat, lon, 20);
    $('lat').value = lat.toFixed(2);
    $('lon').value = lon.toFixed(2);
    var sel = $('place-select');
    var found = PLACES.findIndex(function (p) {
      return Math.abs(p.lat - lat) < 0.02 && Math.abs(p.lon - lon) < 0.02;
    });
    sel.value = found >= 0 ? String(found) : 'custom';
    if (found >= 0) state.place = PLACES[found].n;
    save();
    renderEclipses();
    renderQuarters();
    updateDays(true);
    refresh(false);
  }

  function fillPlaces() {
    var sel = $('place-select');
    sel.innerHTML = PLACES.map(function (p, i) {
      return '<option value="' + i + '">' + p.n + '</option>';
    }).join('') + '<option value="custom">Personalizada…</option>';
    sel.addEventListener('change', function () {
      if (sel.value === 'custom') return;
      var p = PLACES[+sel.value];
      applyLocation(p.lat, p.lon, p.n);
    });
  }

  /* ---------- eventos de UI ---------- */
  function bind() {
    $('scrub').addEventListener('input', function () {
      var mins = +$('scrub').value * STEP_MIN;
      setActiveTime(new Date(state.start.getTime() + mins * 60000));
      stopPlay();
      refresh(true);
    });
    $('days').addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('.day') : null;
      if (!el) return;
      var i = +el.dataset.i, t = activeTime();
      var d = new Date(dayCells[i].date.getTime());
      d.setHours(t.getHours(), t.getMinutes(), 0, 0);
      setActiveTime(d);
      refresh(false);
    });
    $('btn-today').addEventListener('click', function () {
      state.timeA = new Date();
      if (state.compare && state.slot === 'b') state.timeB = new Date();
      buildRange(state.timeA);
      if (scene) scene.resetView(false);
      refresh(false);
      scrollToSelected();
    });
    $('btn-prev').addEventListener('click', function () { nudge(-1); });
    $('btn-next').addEventListener('click', function () { nudge(1); });
    function nudge(n) {
      setActiveTime(addDays(activeTime(), n));
      stopPlay();
      refresh(false);
      scrollToSelected();
    }
    $('btn-play').addEventListener('click', togglePlay);

    $('btn-view').addEventListener('click', function () {
      state.upMode = state.upMode === 'zenith' ? 'north' : 'zenith';
      $('btn-view').classList.toggle('on', state.upMode === 'north');
      $('btn-view').querySelector('.lbl').textContent = state.upMode === 'north' ? 'Norte ↑' : 'Vista';
      save(); updateDays(true); refresh(false); renderQuarters();
    });
    $('btn-labels').addEventListener('click', function () {
      state.labels = !state.labels;
      $('btn-labels').classList.toggle('on', state.labels);
      save(); updateLabels();
    });
    $('btn-compare').addEventListener('click', function () {
      state.compare = !state.compare;
      $('btn-compare').classList.toggle('on', state.compare);
      $('compare-chips').classList.toggle('hidden', !state.compare);
      document.body.classList.toggle('comparing', state.compare);
      if (state.compare && !state.timeB) {
        var q = A.quarters(state.timeA, 4).filter(function (x) { return x.quarter === 2; })[0];
        state.timeB = q ? new Date(q.date.getTime()) : addDays(state.timeA, 7);
      }
      state.slot = 'a';
      updateSlotUI();
      layout();
      refresh(false);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
      c.addEventListener('click', function () {
        state.slot = c.dataset.slot;
        updateSlotUI();
        refresh(false);
        scrollToSelected();
      });
    });
    $('btn-sound').addEventListener('click', function () {
      var on = window.LunaAudio.toggle();
      $('btn-sound').classList.toggle('on', on);
      $('btn-sound').querySelector('.ico').textContent = on ? '🔊' : '🔈';
    });
    $('btn-info').addEventListener('click', function () { $('info').classList.remove('hidden'); });
    $('info-close').addEventListener('click', function () { $('info').classList.add('hidden'); });
    $('info').addEventListener('click', function (e) { if (e.target === $('info')) $('info').classList.add('hidden'); });
    $('feature-close').addEventListener('click', function () { showFeature(null, null); });
    $('btn-panel').addEventListener('click', function () {
      $('panel').classList.toggle('open');
      $('btn-panel').classList.toggle('on', $('panel').classList.contains('open'));
    });
    $('btn-geo').addEventListener('click', function () {
      if (!navigator.geolocation) { $('btn-geo').textContent = 'No disponible'; return; }
      $('btn-geo').textContent = 'Buscando…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        $('btn-geo').textContent = 'Usar mi ubicación';
        applyLocation(+pos.coords.latitude.toFixed(4), +pos.coords.longitude.toFixed(4), 'Tu ubicación');
      }, function () {
        $('btn-geo').textContent = 'Permiso denegado';
        setTimeout(function () { $('btn-geo').textContent = 'Usar mi ubicación'; }, 2500);
      }, { timeout: 10000, maximumAge: 600000 });
    });
    $('btn-loc-apply').addEventListener('click', function () {
      var la = parseFloat($('lat').value), lo = parseFloat($('lon').value);
      if (isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
        applyLocation(la, lo, 'Personalizada');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') { nudge(1); }
      else if (e.key === 'ArrowLeft') { nudge(-1); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Escape') { $('info').classList.add('hidden'); showFeature(null, null); }
      else if (e.key.toLowerCase() === 'h') { $('btn-today').click(); }
      else if (e.key.toLowerCase() === 'l') { $('btn-labels').click(); }
    });
  }

  function updateSlotUI() {
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('active', c.dataset.slot === state.slot);
    });
  }

  /* ---------- animacion del tiempo ---------- */
  var playT0 = 0, playBase = 0;
  function togglePlay() { state.playing ? stopPlay() : startPlay(); }
  function startPlay() {
    state.playing = true;
    playT0 = performance.now();
    playBase = activeTime().getTime();
    $('btn-play').textContent = '❚❚';
    $('btn-play').classList.add('on');
  }
  function stopPlay() {
    if (!state.playing) return;
    state.playing = false;
    $('btn-play').textContent = '▶';
    $('btn-play').classList.remove('on');
    refresh(false);
  }

  /* ---------- bucle de interfaz ---------- */
  var lastLabelTick = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    if (state.playing) {
      var t = playBase + (now - playT0) / 1000 * state.speed * 86400000;
      var d = new Date(t);
      if (!inRange(d)) buildRange(d);
      setActiveTime(d);
      refresh(true);
    }
    if (now - lastLabelTick > 33) { lastLabelTick = now; updateLabels(); }
  }

  /* ---------- arranque ---------- */
  function boot() {
    load();
    fillPlaces();
    state.obs = A.observer(state.lat, state.lon, 20);
    $('lat').value = state.lat.toFixed(2);
    $('lon').value = state.lon.toFixed(2);
    var idx = PLACES.findIndex(function (p) {
      return Math.abs(p.lat - state.lat) < 0.02 && Math.abs(p.lon - state.lon) < 0.02;
    });
    $('place-select').value = idx >= 0 ? String(idx) : 'custom';

    window.LunaDisc.init(window.LUNA_TEX.color, function () { updateDays(true); renderQuarters(); });

    scene = window.LunaScene($('canvas-host'), {
      onClick: function (hit) {
        if (!hit) { showFeature(null, null); return; }
        showFeature(featureAt(hit.lon, hit.lat), hit);
      },
      onHover: function (hit, e) {
        var tip = $('tooltip');
        var f = hit ? featureAt(hit.lon, hit.lat) : null;
        hovering = f;
        if (!f) { tip.classList.add('hidden'); scene && (scene.dom.style.cursor = hit ? 'crosshair' : 'grab'); return; }
        scene.dom.style.cursor = 'pointer';
        tip.classList.remove('hidden');
        tip.textContent = f.n;
        tip.style.left = e.clientX + 'px';
        tip.style.top = e.clientY + 'px';
      }
    });
    if (!scene) { $('fallback').classList.remove('hidden'); }
    else { scene.dom.style.cursor = 'grab'; layout(); }
    window.addEventListener('resize', function () { setTimeout(layout, 60); });

    $('btn-view').classList.toggle('on', state.upMode === 'north');
    if (state.upMode === 'north') $('btn-view').querySelector('.lbl').textContent = 'Norte ↑';
    $('btn-labels').classList.toggle('on', state.labels);

    buildLabels();
    buildRange(state.timeA);
    renderEclipses();
    renderQuarters();
    bind();
    refresh(false);
    scrollToSelected();
    requestAnimationFrame(tick);

    setTimeout(function () { $('hint').classList.add('gone'); }, 9000);
    document.addEventListener('pointerdown', function once() {
      $('hint').classList.add('gone');
      document.removeEventListener('pointerdown', once);
    });

    /* el reloj sigue corriendo: si el usuario esta en "hoy", que se note */
    setInterval(function () {
      if (state.playing) return;
      var t = activeTime();
      if (Math.abs(t - Date.now()) < 90000) { setActiveTime(new Date()); refresh(false); }
    }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
