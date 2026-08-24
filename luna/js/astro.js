/* astro.js — capa de calculo astronomico.
 *
 * Todo sale de astronomy-engine (VSOP87 / algoritmos de alta precision), no hay
 * aproximaciones caseras ni llamadas a APIs: funciona offline y sin cuenta.
 *
 * La pieza central es snapshot(): para un instante, un observador y un modo de
 * vista devuelve todo lo necesario para dibujar la Luna fisicamente correcta:
 *
 *   - sun: direccion Luna->Sol expresada en el marco de la pantalla
 *     (x derecha, y arriba, z hacia el observador). Con eso el terminador y el
 *     angulo del limbo iluminado salen solos, incluida la "vuelta" que se ve
 *     entre hemisferio norte y sur.
 *   - orient: matriz cuerpo->mundo de la Luna (columnas = ejes selenograficos
 *     en coordenadas de pantalla). Incluye libracion y angulo de posicion del
 *     eje, asi que la cara visible es exactamente la que se ve hoy.
 */
(function (global) {
  'use strict';

  var A = global.Astronomy;
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var SYNODIC = 29.530588853;
  /* Umbral clasico de "superluna": 90% del perigeo mas cercano posible. */
  var SUPERMOON_KM = 361863;
  var MICROMOON_KM = 405000;

  /* ---------- vectores ---------- */
  function V(x, y, z) { return { x: x, y: y, z: z }; }
  function sub(a, b) { return V(a.x - b.x, a.y - b.y, a.z - b.z); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  function scale(a, s) { return V(a.x * s, a.y * s, a.z * s); }
  function unit(a) {
    var m = Math.hypot(a.x, a.y, a.z) || 1;
    return V(a.x / m, a.y / m, a.z / m);
  }
  function rotAbout(v, k, ang) {          // Rodrigues
    var c = Math.cos(ang), s = Math.sin(ang), d = dot(k, v) * (1 - c);
    return V(v.x * c + (k.y * v.z - k.z * v.y) * s + k.x * d,
             v.y * c + (k.z * v.x - k.x * v.z) * s + k.y * d,
             v.z * c + (k.x * v.y - k.y * v.x) * s + k.z * d);
  }

  /* ---------- utilidades de tiempo ---------- */
  function time(date) { return A.MakeTime(date); }
  function startOfLocalDay(date) {
    var d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function observer(lat, lon, elev) {
    return new A.Observer(lat, lon, elev || 0);
  }

  /* ---------- fases ---------- */
  var PHASES = [
    { max: 7,   name: 'Luna nueva',        short: 'Nueva',      key: 'new' },
    { max: 83,  name: 'Creciente concava', short: 'Creciente',  key: 'wax-cres' },
    { max: 97,  name: 'Cuarto creciente',  short: 'C. creciente', key: 'first' },
    { max: 173, name: 'Gibosa creciente',  short: 'Gibosa',     key: 'wax-gib' },
    { max: 187, name: 'Luna llena',        short: 'Llena',      key: 'full' },
    { max: 263, name: 'Gibosa menguante',  short: 'Gibosa',     key: 'wan-gib' },
    { max: 277, name: 'Cuarto menguante',  short: 'C. menguante', key: 'last' },
    { max: 353, name: 'Menguante concava', short: 'Menguante',  key: 'wan-cres' },
    { max: 361, name: 'Luna nueva',        short: 'Nueva',      key: 'new' }
  ];
  function phaseLabel(elong) {
    var e = ((elong % 360) + 360) % 360;
    for (var i = 0; i < PHASES.length; i++) if (e < PHASES[i].max) return PHASES[i];
    return PHASES[0];
  }

  /* Ultima luna nueva anterior a t (para la "edad" de la lunacion). */
  function lastNewMoon(t) {
    var nm = A.SearchMoonPhase(0, t.AddDays(-30), 31);
    if (!nm) return null;
    var next = A.SearchMoonPhase(0, nm.AddDays(1), 31);
    if (next && next.ut <= t.ut) nm = next;
    return nm;
  }

  /* ---------- geometria de la vista ----------
   * upMode: 'zenith' = como se ve desde el lugar del observador (cenit arriba),
   *         'north'  = orientacion geocentrica clasica (norte celeste arriba).
   */
  function viewFrame(t, obs, upMode) {
    var moon = A.GeoVector(A.Body.Moon, t, false);
    var sun = A.GeoVector(A.Body.Sun, t, false);
    var w = unit(moon);                       // observador -> Luna (hacia adentro)
    var upRef;
    if (upMode === 'zenith' && obs) {
      upRef = unit(A.ObserverVector(t, obs, false));   // cenit del observador
    } else {
      upRef = V(0, 0, 1);                     // polo norte celeste (EQJ)
    }
    var up = unit(sub(upRef, scale(w, dot(upRef, w))));
    var right = unit(cross(w, up));           // r = d x u  (derecha del observador)
    return {
      w: w, up: up, right: right,
      moon: moon,
      sunFromMoon: unit(sub(sun, moon)),
      toScreen: function (v) { return V(dot(v, right), dot(v, up), -dot(v, w)); }
    };
  }

  /* Marco selenografico (IAU) en coordenadas EQJ, via el eje de rotacion. */
  function bodyFrame(t) {
    var ax = A.RotationAxis(A.Body.Moon, t);
    var N = unit(ax.north);
    var node = unit(V(Math.cos((ax.ra * 15 + 90) * RAD), Math.sin((ax.ra * 15 + 90) * RAD), 0));
    var X = unit(rotAbout(node, N, ax.spin * RAD));   // meridiano 0
    var Y = cross(N, X);                              // longitud +90 este
    return { X: X, Y: Y, Z: N };
  }

  /* ---------- salida / puesta de la Luna para el dia local de `date` ---------- */
  function riseSet(date, obs) {
    if (!obs) return { rise: null, set: null };
    var t0 = A.MakeTime(startOfLocalDay(date));
    var r = A.SearchRiseSet(A.Body.Moon, obs, 1, t0, 1);
    var s = A.SearchRiseSet(A.Body.Moon, obs, -1, t0, 1);
    return { rise: r ? r.date : null, set: s ? s.date : null };
  }

  /* ---------- snapshot ---------- */
  function snapshot(date, obs, upMode, opts) {
    opts = opts || {};
    var t = time(date);
    var ill = A.Illumination(A.Body.Moon, t);
    var elong = A.MoonPhase(t);                    // 0 nueva, 180 llena
    var lib = A.Libration(t);
    var vf = viewFrame(t, obs, upMode);
    var bf = bodyFrame(t);
    var S = vf.toScreen(vf.sunFromMoon);

    /* columnas de la matriz cuerpo->mundo, en coordenadas de pantalla */
    var cx = vf.toScreen(bf.X), cy = vf.toScreen(bf.Y), cz = vf.toScreen(bf.Z);

    var eq = null, hor = null;
    if (obs) {
      eq = A.Equator(A.Body.Moon, t, obs, true, true);
      hor = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');
    }

    var nm = lastNewMoon(t);
    var age = nm ? (t.ut - nm.ut) : NaN;
    var ph = phaseLabel(elong);

    var out = {
      date: new Date(date.getTime()),
      illum: ill.phase_fraction,
      elongation: elong,
      waxing: elong < 180,
      phase: ph,
      age: age,
      lunation: nm ? nm.date : null,
      distKm: lib.dist_km,
      diamDeg: lib.diam_deg,
      libLon: lib.elon,
      libLat: lib.elat,
      magnitude: ill.mag,
      sun: S,                                    // unitario, marco pantalla
      limbAngle: Math.atan2(S.x, S.y),           // 0 = limbo brillante arriba
      orient: [cx.x, cx.y, cx.z, cy.x, cy.y, cy.z, cz.x, cz.y, cz.z], // column-major
      altitude: hor ? hor.altitude : null,
      azimuth: hor ? hor.azimuth : null,
      ra: eq ? eq.ra : null,
      dec: eq ? eq.dec : null,
      supermoon: false,
      micromoon: false
    };

    /* "Superluna" solo tiene sentido cerca de la luna llena. */
    if (Math.abs(180 - elong) < 12) {
      out.supermoon = lib.dist_km < SUPERMOON_KM;
      out.micromoon = lib.dist_km > MICROMOON_KM;
    }

    if (opts.riseSet !== false) {
      var rs = riseSet(date, obs);
      out.rise = rs.rise;
      out.set = rs.set;
    }
    return out;
  }

  /* ---------- proximas fases principales ---------- */
  var QUARTER_NAMES = ['Luna nueva', 'Cuarto creciente', 'Luna llena', 'Cuarto menguante'];
  function quarters(from, count) {
    var q = A.SearchMoonQuarter(time(from)), out = [];
    for (var i = 0; i < count; i++) {
      var lib = A.Libration(q.time);
      out.push({
        quarter: q.quarter,
        name: QUARTER_NAMES[q.quarter],
        date: q.time.date,
        distKm: lib.dist_km,
        supermoon: q.quarter === 2 && lib.dist_km < SUPERMOON_KM,
        micromoon: q.quarter === 2 && lib.dist_km > MICROMOON_KM
      });
      q = A.NextMoonQuarter(q);
    }
    return out;
  }

  /* ---------- eclipses ---------- */
  var ECLIPSE_KIND = {
    penumbral: 'penumbral', partial: 'parcial', annular: 'anular', total: 'total'
  };
  function eclipses(from, obs) {
    var t = time(from), res = { lunar: null, solar: null };
    try {
      var le = A.SearchLunarEclipse(t);
      var visible = null, alt = null;
      if (obs) {
        var eq = A.Equator(A.Body.Moon, le.peak, obs, true, true);
        alt = A.Horizon(le.peak, obs, eq.ra, eq.dec, 'normal').altitude;
        visible = alt > 0;
      }
      res.lunar = {
        kind: ECLIPSE_KIND[le.kind] || le.kind,
        date: le.peak.date,
        obscuration: le.obscuration,
        totalMin: le.sd_total * 2,
        partialMin: le.sd_partial * 2,
        altitude: alt,
        visible: visible
      };
    } catch (e) { /* sin datos: se omite */ }
    try {
      var se = obs ? A.SearchLocalSolarEclipse(t, obs) : null;
      if (se) {
        res.solar = {
          kind: ECLIPSE_KIND[se.kind] || se.kind,
          date: se.peak.time.date,
          obscuration: se.obscuration,
          altitude: se.peak.altitude,
          local: true
        };
      } else {
        var gs = A.SearchGlobalSolarEclipse(t);
        res.solar = {
          kind: ECLIPSE_KIND[gs.kind] || gs.kind,
          date: gs.peak.date,
          obscuration: gs.obscuration,
          lat: gs.latitude, lon: gs.longitude,
          local: false
        };
      }
    } catch (e) { /* idem */ }
    return res;
  }

  /* ---------- perigeo / apogeo ---------- */
  function apsides(from, count) {
    var ap = A.SearchLunarApsis(time(from)), out = [];
    for (var i = 0; i < count; i++) {
      out.push({
        kind: ap.kind === 0 ? 'perigeo' : 'apogeo',
        date: ap.time.date,
        distKm: ap.dist_km
      });
      ap = A.NextLunarApsis(ap);
    }
    return out;
  }

  /* Convierte un punto de la esfera (coordenadas cuerpo) a lon/lat selenografica. */
  function bodyToLonLat(p) {
    return {
      lon: Math.atan2(p.y, p.x) * DEG,
      lat: Math.asin(Math.max(-1, Math.min(1, p.z / (Math.hypot(p.x, p.y, p.z) || 1)))) * DEG
    };
  }
  function lonLatToBody(lon, lat) {
    var cl = Math.cos(lat * RAD);
    return V(cl * Math.cos(lon * RAD), cl * Math.sin(lon * RAD), Math.sin(lat * RAD));
  }

  global.LunaAstro = {
    RAD: RAD, DEG: DEG, SYNODIC: SYNODIC,
    SUPERMOON_KM: SUPERMOON_KM,
    observer: observer,
    snapshot: snapshot,
    riseSet: riseSet,
    quarters: quarters,
    eclipses: eclipses,
    apsides: apsides,
    phaseLabel: phaseLabel,
    bodyToLonLat: bodyToLonLat,
    lonLatToBody: lonLatToBody,
    startOfLocalDay: startOfLocalDay
  };
})(typeof window !== 'undefined' ? window : globalThis);
