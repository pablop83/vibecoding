/**
 * Hero pixel-reveal effect
 * Adapted from Codrops / J0SUKE — Scroll-Revealed WebGL Gallery
 * https://tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js/
 *
 * Approach: a full-screen WebGL canvas sits on top of the hero section.
 * It starts as a solid dark screen. A horizontal sweep (bottom → top) reveals
 * the hero HTML beneath by dissolving square tiles — with a scattering pink
 * mosaic edge that matches the brand accent colour.
 */

(function () {
  'use strict';

  /* ── Power2 easing (in/out) ─────────────────────────────────────── */
  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /* ── Vertex shader ─────────────────────────────────────────────── */
  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  /* ── Fragment shader ───────────────────────────────────────────── */
  /* Adapted from /src/app/shaders/fragment.glsl in the Codrops repo.
   *
   * Key changes vs the original:
   *   • No texture uniform — the hero content is rendered as normal HTML below.
   *   • Two colour uniforms: uBgColor (solid cover) + uTileColor (mosaic edge).
   *   • Square pixel grid derived from actual pixel dimensions (uContainerRes).
   *   • The canvas alpha is 0 above the sweep (hero HTML shows through) and 1
   *     below it (solid bg covers the hero until the sweep reaches that row).
   */
  var FRAG = [
    'uniform vec2  uContainerRes;',
    'uniform float uProgress;',
    'uniform vec3  uTileColor;',
    'uniform vec3  uBgColor;',
    'varying vec2  vUv;',

    'float random(vec2 st) {',
    '  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);',
    '}',

    'void main() {',
    /* Square-pixel grid — cell size = containerWidth / 35 pixels */
    '  float cellPx  = max(floor(uContainerRes.x / 35.0), 1.0);',
    '  vec2  cellUv  = floor(vUv * uContainerRes / cellPx) * cellPx / uContainerRes;',

    /* Sweep line: travels from y=1.15 (below canvas) to y=-0.15 (above canvas) */
    '  float h        = 0.15;',
    '  float progress = (1.0 + h) - (uProgress * (1.0 + 2.0 * h));',

    /* Solid cover below sweep */
    '  float below = 1.0 - step(progress, cellUv.y);',

    /* Scattered mosaic edge — identical math to Codrops fragment.glsl */
    '  float dist     = 1.0 - distance(cellUv.y, progress);',
    '  float cDist    = smoothstep(h, 0.0, distance(cellUv.y, progress));',
    '  float rand     = random(cellUv);',
    '  float randDist = step(1.0 - h * rand, dist);',
    '  dist           = step(1.0 - h, dist);',
    '  float edge     = dist * (cDist + rand - 0.5 * (1.0 - randDist));',
    '  edge           = max(0.0, edge);',

    /* Composite: transparent above / tileColour at edge / bgColour below */
    '  float totalAlpha = max(below, edge);',
    '  float tileWeight = edge / max(totalAlpha, 0.001);',
    '  vec3  colour     = mix(uBgColor, uTileColor, tileWeight);',

    '  gl_FragColor = vec4(colour, totalAlpha);',
    '}'
  ].join('\n');

  /* ── Bootstrap — split into two phases ─────────────────────────────
   *
   * Phase 1 · initCanvas()
   *   Called as soon as the preloader scramble settles (while the
   *   overlay is still visible). Sets up Three.js, renders a solid
   *   black frame at z-index 100, and waits. When the preloader then
   *   fades out, the hero HTML beneath is already covered — no flash.
   *
   * Phase 2 · startReveal()
   *   Called once the preloader overlay is fully gone. Kicks off the
   *   pixel-reveal RAF loop.
   */
  var _startReveal = null; /* filled by initCanvas, called by phase-2 handler */

  /* Resolves once the pixel-reveal canvas has fully faded out */
  var _resolveHeroReveal;
  window.heroRevealPromise = new Promise(function (r) { _resolveHeroReveal = r; });

  function initCanvas() {
    var slide  = document.getElementById('slide-cover');
    var canvas = document.getElementById('hero-canvas');

    if (!slide || !canvas || typeof THREE === 'undefined') {
      /* Fallback: expose a no-op so phase-2 handler doesn't throw */
      _startReveal = function () {};
      return;
    }

    /* Dimensions — hero fills the full viewport height */
    var W = Math.round(slide.offsetWidth);
    var H = Math.round(slide.offsetHeight);

    /* ── Three.js setup ────────────────────────────────────────────── */
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);

    var scene  = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    var uniforms = {
      uContainerRes: { value: new THREE.Vector2(W, H) },
      uProgress:     { value: 0.0 },
      uTileColor:    { value: new THREE.Color('#F0C5F6') },
      uBgColor:      { value: new THREE.Color('#000000') },
    };

    var mat  = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms, transparent: true });
    var geo  = new THREE.PlaneGeometry(2, 2);
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    function render() { renderer.render(scene, camera); }
    render(); /* solid black frame — covers hero HTML behind the preloader */

    /* ── Resize handler ───────────────────────────────────────────── */
    function onResize() {
      var nW = Math.round(slide.offsetWidth);
      var nH = Math.round(slide.offsetHeight);
      renderer.setSize(nW, nH);
      uniforms.uContainerRes.value.set(nW, nH);
      render();
    }
    window.addEventListener('resize', onResize);

    /* ── Finish: fade canvas out ──────────────────────────────────── */
    function finishReveal() {
      window.removeEventListener('resize', onResize);
      canvas.style.transition = 'opacity 0.5s ease';
      canvas.style.opacity    = '0';
      setTimeout(function () {
        canvas.style.display = 'none';
        renderer.dispose();
        mat.dispose();
        geo.dispose();
      }, 550);
    }

    /* ── Phase-2 entry point: begin pixel reveal ──────────────────── */
    var DURATION_MS    = 2200;
    var SCRAMBLE_AT    = 0.6;  /* fire title scramble when reveal is 60% done */
    var startTs        = null;
    var scrambleFired  = false;

    _startReveal = function () {
      function tick(ts) {
        if (!startTs) startTs = ts;
        var elapsed  = ts - startTs;
        var raw      = Math.min(elapsed / DURATION_MS, 1.0);
        var progress = ease(raw);
        uniforms.uProgress.value = progress;
        render();

        /* Fire title scramble at 60% of the reveal so it overlaps */
        if (!scrambleFired && raw >= SCRAMBLE_AT) {
          scrambleFired = true;
          if (window._initTitleReveal) window._initTitleReveal();
        }

        if (raw < 1.0) {
          requestAnimationFrame(tick);
        } else {
          finishReveal();
        }
      }
      requestAnimationFrame(tick);
    };
  }

  /* ── Wiring ─────────────────────────────────────────────────────── */
  if (window.preloaderPhase1Promise && window.preloaderPromise) {
    /* Two-phase: canvas goes black in phase 1, reveal starts in phase 2 */
    window.preloaderPhase1Promise.then(function () {
      initCanvas();
    });
    window.preloaderPromise.then(function () {
      if (_startReveal) _startReveal();
    });
  } else {
    /* No preloader — just run immediately */
    initCanvas();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (_startReveal) _startReveal();
      });
    } else {
      if (_startReveal) _startReveal();
    }
  }
})();
