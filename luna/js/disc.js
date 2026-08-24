/* disc.js — miniaturas de la Luna para la linea de tiempo.
 *
 * No dibuja una elipse "de fase": recorre pixel por pixel el hemisferio visible,
 * lo orienta con la misma matriz que la escena 3D y lo ilumina con el mismo
 * vector solar. Asi cada dia del calendario muestra los mares reales en la
 * posicion real y el terminador con la inclinacion que le corresponde.
 */
(function (global) {
  'use strict';

  var tex = null, TW = 512, TH = 256, ready = false, pending = [];

  function init(dataUri, onReady) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = TW; c.height = TH;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, TW, TH);
      try { tex = ctx.getImageData(0, 0, TW, TH).data; ready = true; } catch (e) { ready = false; }
      pending.forEach(function (f) { f(); });
      pending = [];
      if (onReady) onReady();
    };
    img.onerror = function () { if (onReady) onReady(); };
    img.src = dataUri;
  }
  function onReady(fn) { if (ready) fn(); else pending.push(fn); }

  /* canvas: destino (ya dimensionado). snap: salida de LunaAstro.snapshot. */
  function draw(canvas, snap, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    var R = Math.min(W, H) / 2 - (opts.pad || 1);
    var cx = W / 2, cy = H / 2;
    var img = ctx.createImageData(W, H), px = img.data;
    var m = snap.orient;                       // columnas cuerpo->pantalla
    var sx = snap.sun.x, sy = snap.sun.y, sz = snap.sun.z;
    var earth = 0.020 * Math.pow(1 - snap.illum, 1.15) + 0.0015;
    var gamma = 1 / 2.2, edge = 1.2 / R;

    for (var y = 0; y < H; y++) {
      var ny = -(y + 0.5 - cy) / R;
      for (var x = 0; x < W; x++) {
        var nx = (x + 0.5 - cx) / R;
        var r2 = nx * nx + ny * ny;
        if (r2 > 1 + edge * 3) continue;
        var nz = Math.sqrt(Math.max(0, 1 - r2));
        /* cuerpo = M^T * n  (M ortonormal) */
        var bx = m[0] * nx + m[1] * ny + m[2] * nz;
        var by = m[3] * nx + m[4] * ny + m[5] * nz;
        var bz = m[6] * nx + m[7] * ny + m[8] * nz;
        var alb = 0.30;
        if (ready) {
          var lon = Math.atan2(by, bx), lat = Math.asin(Math.max(-1, Math.min(1, bz)));
          var u = ((lon / Math.PI + 1) * 0.5) * TW;
          var v = ((0.5 - lat / Math.PI)) * TH;
          var ti = ((Math.min(TH - 1, Math.max(0, v | 0)) * TW) + Math.min(TW - 1, Math.max(0, u | 0))) * 4;
          alb = Math.pow(tex[ti] / 255, 2.2) * 1.05;
        }
        var mu0 = nx * sx + ny * sy + nz * sz;
        var lit = mu0 > 0 ? mu0 : 0;
        var ls = 2 * lit / Math.max(lit + nz, 1e-3);
        var brdf = ls * 0.78 + lit * 0.22;
        var val = alb * brdf * 1.45 + alb * earth * 1.6;
        val = val / (1 + val * 0.55);
        var c = Math.pow(Math.max(0, val), gamma);
        var rr = c * 252, gg = c * 253, bb = c * 255;
        if (mu0 <= 0) { rr *= 0.86; gg *= 0.94; }      // lado oscuro, apenas azulado
        var a = 1;
        var rr2 = Math.sqrt(r2);
        if (rr2 > 1 - edge) a = Math.max(0, (1 - rr2) / edge);
        if (a <= 0) continue;
        var o = (y * W + x) * 4;
        px[o] = rr; px[o + 1] = gg; px[o + 2] = bb; px[o + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  global.LunaDisc = { init: init, draw: draw, onReady: onReady, get ready() { return ready; } };
})(typeof window !== 'undefined' ? window : globalThis);
