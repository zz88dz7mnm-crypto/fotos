/* scene.js — escena 3D de la Luna (three.js).
 *
 * Convencion del mundo: la camara "de la Tierra" mira desde +Z hacia el origen
 * con +Y arriba, asi que el marco del mundo coincide con el marco de pantalla
 * que devuelve astro.js. Consecuencias:
 *   - la direccion del Sol es directamente snapshot.sun,
 *   - la direccion de la Tierra vista desde la Luna es (0,0,1),
 *   - girar la camara equivale a viajar alrededor de la Luna: la iluminacion
 *     sigue siendo la real, se ve la cara oculta como la veria una sonda.
 */
(function (global) {
  'use strict';

  var THREE = global.THREE;
  var DEG = Math.PI / 180;

  /* ---------- geometria: esfera en coordenadas selenograficas ----------
   * x -> longitud 0 (centro de la cara visible), y -> longitud 90 E, z -> norte.
   * uv coincide con el mapa equirectangular: u=0 en lon -180, v=1 en el polo N.
   */
  function moonGeometry(segX, segY) {
    var pos = [], nor = [], uv = [], idx = [];
    for (var i = 0; i <= segY; i++) {
      var v = i / segY, lat = (90 - 180 * v) * DEG, cl = Math.cos(lat), sl = Math.sin(lat);
      for (var j = 0; j <= segX; j++) {
        var u = j / segX, lon = (-180 + 360 * u) * DEG;
        var x = cl * Math.cos(lon), y = cl * Math.sin(lon), z = sl;
        pos.push(x, y, z); nor.push(x, y, z); uv.push(u, 1 - v);
      }
    }
    for (i = 0; i < segY; i++) {
      for (j = 0; j < segX; j++) {
        var a = i * (segX + 1) + j, b = a + segX + 1;
        if (i !== 0) idx.push(a, b, a + 1);
        if (i !== segY - 1) idx.push(b, b + 1, a + 1);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  var VERT = [
    'varying vec2 vUv;',
    'varying vec3 vN; varying vec3 vT; varying vec3 vB; varying vec3 vWorld; varying vec3 vBody;',
    'void main() {',
    '  vUv = uv; vBody = position;',
    '  vec3 c = cross(vec3(0.0, 0.0, 1.0), position);',
    '  vec3 T = normalize(length(c) > 1e-4 ? c : vec3(1.0, 0.0, 0.0));', // este
    '  vec3 B = cross(normal, T);',                                       // norte
    '  mat3 M = mat3(modelMatrix);',
    '  vN = normalize(M * normal); vT = normalize(M * T); vB = normalize(M * B);',
    '  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  /* Fotometria: la Luna no es lambertiana. Lommel-Seeliger (dispersion simple en
   * un regolito muy poroso) explica por que la luna llena se ve como un disco
   * plano y parejo en vez de una bola sombreada, y por que el limbo no se
   * oscurece. Se le suma el pico de oposicion y un poco de Lambert. */
  var FRAG = [
    'uniform sampler2D uColor; uniform sampler2D uRelief;',
    'uniform vec2 uTexel;',
    'uniform vec3 uSun; uniform vec3 uEarth;',
    'uniform float uBump; uniform float uExposure; uniform float uEarthshine;',
    'uniform float uOpposition; uniform float uLambert; uniform float uDetail;',
    'varying vec2 vUv;',
    'varying vec3 vN; varying vec3 vT; varying vec3 vB; varying vec3 vWorld; varying vec3 vBody;',
    'float hgt(vec2 p) { return texture2D(uRelief, p).r; }',
    'void main() {',
    '  float hL = hgt(vUv - vec2(uTexel.x, 0.0)), hR = hgt(vUv + vec2(uTexel.x, 0.0));',
    '  float hD = hgt(vUv - vec2(0.0, uTexel.y)), hU = hgt(vUv + vec2(0.0, uTexel.y));',
    '  float cosLat = max(0.30, sqrt(max(0.0, 1.0 - vBody.z * vBody.z)));',
    '  float dE = (hR - hL) / (2.0 * uTexel.x * cosLat);',
    '  float dN = (hU - hD) / (2.0 * uTexel.y);',
    '  vec3 N = normalize(vN - uBump * (dE * vT + dN * vB));',
    '  vec3 V = normalize(cameraPosition - vWorld);',
    '  float mu0 = max(dot(N, uSun), 0.0);',
    '  float mu  = max(dot(N, V), 0.0);',
    '  float shadow = smoothstep(-0.02, 0.07, dot(vN, uSun));',   // sombra propia del terreno
    '  float lit = mu0 * shadow;',
    '  float ls = 1.7 * lit / max(lit + mu, 1e-3);',              // Lommel-Seeliger normalizado
    '  float brdf = mix(ls, lit, uLambert);',
    '  float alpha = acos(clamp(dot(uSun, V), -1.0, 1.0));',      // angulo de fase local
    '  float surge = 1.0 + uOpposition * exp(-alpha / 0.06);',    // pico de oposicion
    '  vec3 alb = pow(texture2D(uColor, vUv).rgb, vec3(2.2));',
    '  float relief = hgt(vUv);',
    '  alb *= 1.0 - uDetail * 0.5 + uDetail * relief;',
    '  float luma = dot(alb, vec3(0.299, 0.587, 0.114));',
    '  alb *= mix(vec3(0.94, 0.97, 1.07), vec3(1.06, 1.0, 0.93), smoothstep(0.03, 0.30, luma));',
    '  vec3 col = alb * brdf * surge * uExposure;',
    '  col += alb * max(dot(N, uEarth), 0.0) * uEarthshine * vec3(0.55, 0.68, 1.0);',  // luz cenicienta
    '  col = col / (1.0 + col * 0.25);',
    '  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);',
    '}'
  ].join('\n');

  var STAR_VERT = [
    'attribute float aSize; attribute float aPhase;',
    'uniform float uPixelRatio; uniform float uTime;',
    'varying float vAlpha; varying vec3 vColor;',
    'void main() {',
    '  vColor = color;',
    '  vAlpha = 0.75 + 0.25 * sin(uTime * 0.7 + aPhase * 6.283);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = aSize * uPixelRatio;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var STAR_FRAG = [
    'varying float vAlpha; varying vec3 vColor;',
    'void main() {',
    '  vec2 d = gl_PointCoord - 0.5;',
    '  float r = length(d) * 2.0;',
    '  float a = smoothstep(1.0, 0.0, r);',
    '  a *= a;',
    '  gl_FragColor = vec4(vColor, a * vAlpha);',
    '}'
  ].join('\n');

  function starField(count) {
    var pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    var siz = new Float32Array(count), pha = new Float32Array(count);
    var R = 600;
    /* Plano "galactico" arbitrario para insinuar la Via Lactea. */
    var gn = new THREE.Vector3(0.31, 0.85, -0.42).normalize();
    for (var i = 0; i < count; i++) {
      var v, tries = 0;
      do {
        v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        tries++;
      } while (v.lengthSq() > 1 || v.lengthSq() < 1e-6);
      v.normalize();
      var band = Math.exp(-Math.pow(v.dot(gn) / 0.16, 2));   // 1 sobre el plano
      var keep = i % 3 === 0 ? band > Math.random() * 0.9 : true;
      if (!keep) { v.addScaledVector(gn, -v.dot(gn) * (0.6 + 0.4 * Math.random())).normalize(); }
      pos[i * 3] = v.x * R; pos[i * 3 + 1] = v.y * R; pos[i * 3 + 2] = v.z * R;
      /* Distribucion de brillos: muchas debiles, pocas brillantes. */
      var m = Math.pow(Math.random(), 3.2);
      var bright = 0.20 + 0.80 * m + 0.25 * band;
      siz[i] = 0.9 + 3.4 * m + 0.5 * band;
      var temp = Math.random();
      var r = bright * (temp < 0.18 ? 1.0 : temp > 0.86 ? 0.82 : 0.95);
      var g = bright * (temp < 0.18 ? 0.85 : temp > 0.86 ? 0.88 : 0.96);
      var b = bright * (temp < 0.18 ? 0.72 : temp > 0.86 ? 1.0 : 0.98);
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      pha[i] = Math.random();
    }
    var g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g2.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g2.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    g2.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, vertexColors: true,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Points(g2, mat);
  }

  function glowTexture() {
    var s = 256, c = document.createElement('canvas');
    c.width = c.height = s;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(s / 2, s / 2, s * 0.20, s / 2, s / 2, s * 0.5);
    g.addColorStop(0, 'rgba(190,215,255,0.34)');
    g.addColorStop(0.35, 'rgba(150,185,240,0.10)');
    g.addColorStop(1, 'rgba(120,160,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    var t = new THREE.CanvasTexture(c);
    return t;
  }

  function loadTexture(dataUri, srgbLike, onDone) {
    var tex = new THREE.TextureLoader().load(dataUri, onDone);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }

  global.LunaScene = function (container, opts) {
    opts = opts || {};
    var renderer, scene, camera, moon, stars, glow, uniforms;
    var raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    var clock = { t0: performance.now() };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { return null; }
    if (!renderer) return null;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x04060c, 1);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.05, 3000);

    var maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
    var texColor = loadTexture(global.LUNA_TEX.color);
    var texRelief = loadTexture(global.LUNA_TEX.relief);
    texColor.anisotropy = Math.min(8, maxAniso);
    texRelief.anisotropy = Math.min(8, maxAniso);

    uniforms = {
      uColor: { value: texColor },
      uRelief: { value: texRelief },
      uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
      uSun: { value: new THREE.Vector3(1, 0, 0) },
      uEarth: { value: new THREE.Vector3(0, 0, 1) },
      uBump: { value: 0.0021 },
      uExposure: { value: 2.05 },
      uEarthshine: { value: 0.02 },
      uOpposition: { value: 0.30 },
      uLambert: { value: 0.22 },
      uDetail: { value: 0.30 }
    };

    moon = new THREE.Mesh(
      moonGeometry(256, 128),
      new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG })
    );
    moon.matrixAutoUpdate = true;
    scene.add(moon);

    stars = starField(15000);
    scene.add(stars);

    /* El halo va detras del disco: como es transparente three.js lo dibuja
       despues de lo opaco, asi que se apoya en el test de profundidad (el
       sprite esta a la profundidad del centro de la Luna, o sea detras de la
       cara visible) para que solo se vea el resplandor que sobresale. */
    glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, opacity: 0.5
    }));
    glow.scale.set(4.2, 4.2, 1);
    scene.add(glow);

    /* ---------- camara orbital ---------- */
    var view = { theta: 0, phi: Math.PI / 2, dist: 8, target: { theta: 0, phi: Math.PI / 2, dist: 8 } };
    var fillFrac = null;
    var dragging = false, lastX = 0, lastY = 0, pinch = 0, moved = false;
    var MIN_D = 1.25, MAX_D = 26;

    function defaultDist() {
      var vFov = camera.fov * DEG;
      var hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      var half = Math.min(vFov, hFov) / 2;
      var fill = fillFrac !== null ? fillFrac : (window.innerWidth < 760 ? 0.74 : 0.62);
      return 1 / Math.sin(Math.max(0.08, half * fill));
    }
    var centerFx = 0, centerFy = 0;      // corrimiento del centro optico (fraccion de la semipantalla)
    var tmpTarget = new THREE.Vector3();
    function applyCamera() {
      var s = Math.sin(view.phi);
      camera.position.set(
        view.dist * s * Math.sin(view.theta),
        view.dist * Math.cos(view.phi),
        view.dist * s * Math.cos(view.theta)
      );
      camera.up.set(0, 1, 0);
      /* Mover el blanco de la camara deja la Luna descentrada a proposito, para
         que no quede tapada por el panel ni por la linea de tiempo. */
      var halfH = view.dist * Math.tan(camera.fov * DEG / 2);
      var halfW = halfH * camera.aspect;
      camera.lookAt(0, 0, 0);
      if (centerFx || centerFy) {
        var right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        var upv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        tmpTarget.copy(right).multiplyScalar(-centerFx * halfW)
          .addScaledVector(upv, -centerFy * halfH);
        camera.lookAt(tmpTarget);
      }
    }
    function resetView(instant) {
      view.target.theta = 0; view.target.phi = Math.PI / 2; view.target.dist = defaultDist();
      if (instant) { view.theta = 0; view.phi = Math.PI / 2; view.dist = view.target.dist; applyCamera(); }
    }

    function resize() {
      var w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      stars.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      var d = defaultDist();
      if (Math.abs(view.target.dist - view.dist) < 1e-3 && !dragging) {
        view.target.dist = d;
      }
    }

    var el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (dragging) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        var k = 0.0052 * Math.min(1, view.dist / 6 + 0.35);
        view.target.theta -= dx * k;
        view.target.phi = Math.max(0.05, Math.min(Math.PI - 0.05, view.target.phi - dy * k));
      } else if (opts.onHover) {
        opts.onHover(pickAt(e.clientX, e.clientY), e);
      }
    });
    function endDrag(e) {
      if (dragging && !moved && opts.onClick) opts.onClick(pickAt(e.clientX, e.clientY), e);
      dragging = false;
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', function () { dragging = false; });
    el.addEventListener('pointerleave', function () { if (opts.onHover) opts.onHover(null); });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      var f = Math.exp(Math.sign(e.deltaY) * Math.min(0.35, Math.abs(e.deltaY) * 0.0016));
      view.target.dist = Math.max(MIN_D, Math.min(MAX_D, view.target.dist * f));
    }, { passive: false });
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinch) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        view.target.dist = Math.max(MIN_D, Math.min(MAX_D, view.target.dist * (pinch / d)));
        pinch = d;
        e.preventDefault();
      }
    }, { passive: false });
    el.addEventListener('dblclick', function () { resetView(false); });

    /* ---------- picking ---------- */
    function pickAt(clientX, clientY) {
      var r = el.getBoundingClientRect();
      pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObject(moon, false);
      if (!hits.length) return null;
      var p = hits[0].point.clone();
      moon.updateMatrixWorld();
      var inv = new THREE.Matrix4().copy(moon.matrixWorld).invert();
      p.applyMatrix4(inv).normalize();
      var lon = Math.atan2(p.y, p.x) / DEG;
      var lat = Math.asin(Math.max(-1, Math.min(1, p.z))) / DEG;
      return { lon: lon, lat: lat, point: hits[0].point.clone() };
    }

    /* ---------- estado astronomico ---------- */
    var mat4 = new THREE.Matrix4();
    function applySnapshot(s) {
      var o = s.orient;
      mat4.set(o[0], o[3], o[6], 0,
               o[1], o[4], o[7], 0,
               o[2], o[5], o[8], 0,
               0, 0, 0, 1);
      moon.quaternion.setFromRotationMatrix(mat4);
      uniforms.uSun.value.set(s.sun.x, s.sun.y, s.sun.z).normalize();
      uniforms.uEarthshine.value = 0.017 * Math.pow(1 - s.illum, 1.15) + 0.0012;
      glow.material.opacity = 0.10 + 0.26 * s.illum;
      var g = 2.5 + 0.9 * s.illum;
      glow.scale.set(g, g, 1);
    }

    var current = null, compare = null, compareInset = 0;
    function setSnapshot(s) { current = s; applySnapshot(s); }
    function setCompare(a, b) { compare = (a && b) ? [a, b] : null; }

    /* ---------- bucle ---------- */
    function step() {
      var damp = 0.14;
      view.theta += (view.target.theta - view.theta) * damp;
      view.phi += (view.target.phi - view.phi) * damp;
      view.dist += (view.target.dist - view.dist) * damp;
      applyCamera();
      stars.material.uniforms.uTime.value = (performance.now() - clock.t0) / 1000;
      glow.position.set(0, 0, 0);

      var w = container.clientWidth, h = container.clientHeight;
      if (compare) {
        renderer.setScissorTest(true);
        /* El area util excluye el ancho del panel para que la mitad derecha no
           quede escondida detras. */
        var avail = Math.max(200, w - compareInset);
        var half = Math.floor(avail / 2);
        for (var i = 0; i < 2; i++) {
          var x = i === 0 ? 0 : half;
          var cw = i === 0 ? half : avail - half;
          renderer.setViewport(x, 0, cw, h);
          renderer.setScissor(x, 0, cw, h);
          camera.aspect = cw / h;
          camera.updateProjectionMatrix();
          applySnapshot(compare[i]);
          renderer.render(scene, camera);
        }
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (current) applySnapshot(current);
      } else {
        renderer.render(scene, camera);
      }
    }
    renderer.setAnimationLoop(step);

    resize();
    resetView(true);
    window.addEventListener('resize', resize);

    /* Proyecta un punto selenografico a pixeles de pantalla. */
    var tmpV = new THREE.Vector3();
    function project(lon, lat) {
      var cl = Math.cos(lat * DEG);
      tmpV.set(cl * Math.cos(lon * DEG), cl * Math.sin(lon * DEG), Math.sin(lat * DEG));
      moon.updateMatrixWorld();
      tmpV.applyMatrix4(moon.matrixWorld);
      var world = tmpV.clone();
      var toCam = camera.position.clone().sub(world).normalize();
      var nrm = world.clone().normalize();
      var facing = nrm.dot(toCam);
      tmpV.project(camera);
      return {
        x: (tmpV.x * 0.5 + 0.5) * container.clientWidth,
        y: (-tmpV.y * 0.5 + 0.5) * container.clientHeight,
        facing: facing,
        sunlit: nrm.dot(uniforms.uSun.value)
      };
    }

    return {
      dom: el,
      uniforms: uniforms,
      setSnapshot: setSnapshot,
      setCompare: setCompare,
      resetView: resetView,
      resize: resize,
      project: project,
      pickAt: pickAt,
      camera: camera,
      get distance() { return view.dist; },
      setDistance: function (d) { view.target.dist = Math.max(MIN_D, Math.min(MAX_D, d)); },
      spin: function (dTheta) { view.target.theta += dTheta; },
      setViewCenter: function (fx, fy) { centerFx = fx; centerFy = fy; },
      setCompareInset: function (px) { compareInset = px; },
      setFill: function (f) { fillFrac = f; view.target.dist = defaultDist(); }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
