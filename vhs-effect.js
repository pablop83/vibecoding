/**
 * VHS Glitch Background Effect
 * Ported from Efecto / React Three Fiber export to vanilla Three.js.
 * Runs the exact same fragment shader but reads from uTexture (bg-texture.webp)
 * instead of a postprocessing inputBuffer.
 *
 * Ref: https://tympanus.net/codrops / Efecto VHS Glitch
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────
     Vertex shader
     Flip UV.y to match the CSS transform:scaleY(-1) that was on the
     original <img class="cover-bg">, which we're now replacing.
  ───────────────────────────────────────────────────────────────── */
  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = vec2(uv.x, 1.0 - uv.y);',  /* compensate for removed scaleY(-1) */
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  /* ─────────────────────────────────────────────────────────────────
     Fragment shader — identical logic to the Efecto export, with
     `inputBuffer` replaced by `uTexture`.
  ───────────────────────────────────────────────────────────────── */
  var FRAG = [
    'precision highp float;',
    '',
    'uniform sampler2D uTexture;',
    'uniform float uTime;',
    'uniform float uGrain;',
    'uniform float uGlitchBlocks;',
    'uniform float uRgbShift;',
    'uniform float uScanlines;',
    'uniform float uNoise;',
    'uniform float uDistortion;',
    'uniform float uSpeed;',
    '',
    'varying vec2 vUv;',
    '',
    '// Pseudo-random (same hash as the original)',
    'float rand(vec2 co) {',
    '  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',
    '',
    '// VHS vertical-bar distortion helper',
    'float verticalBar(float pos, float uvY, float offset) {',
    '  float x  = smoothstep(pos - 0.02, pos, uvY) * offset;',
    '  x -= smoothstep(pos, pos + 0.02, uvY) * offset;',
    '  return x;',
    '}',
    '',
    'void main() {',
    '  vec2  uv       = vUv;',
    '  float t        = uTime * uSpeed;',
    '  vec2  texCoord = uv;',
    '',
    '  // === VHS VERTICAL BAR DISTORTION ===',
    '  // Unrolled to integer loop for max WebGL 1 compatibility.',
    '  // Matches the original float loop: i = 0, 0.1313 … 0.6565 (6 steps)',
    '  for (int n = 0; n < 6; n++) {',
    '    float fi = float(n) * 0.1313;',
    '    float d  = mod(t * fi, 1.7);',
    '    float o  = sin(1.0 - tan(t * 0.24 * fi)) * uDistortion * 0.05;',
    '    texCoord.x += verticalBar(d, texCoord.y, o);',
    '  }',
    '',
    '  // === NOISE DISPLACEMENT ===',
    '  float noiseY   = floor(texCoord.y * 250.0) / 250.0;',
    '  float noiseVal = rand(vec2(t * 0.00001, noiseY));',
    '  texCoord.x    += noiseVal * uNoise * 0.01;',
    '',
    '  // === RGB SHIFT / CHROMATIC ABERRATION ===',
    '  vec2  dir    = texCoord - 0.5;',
    '  float dLen   = length(dir);',
    '  vec2  nDir   = dLen > 0.001 ? normalize(dir) : vec2(0.0);',
    '  vec2  chrOff = dLen * 0.7 * nDir * uRgbShift * 0.02;',
    '  vec2  offR   = chrOff + vec2(sin(t)         * 0.003, 0.0) * uRgbShift;',
    '  vec2  offB   = -chrOff + vec2(cos(t * 0.97) * 0.003, 0.0) * uRgbShift;',
    '  float r = texture2D(uTexture, texCoord + offR).r;',
    '  float g = texture2D(uTexture, texCoord       ).g;',
    '  float b = texture2D(uTexture, texCoord + offB).b;',
    '  vec3  color = vec3(r, g, b);',
    '',
    '  // === SCANLINES ===',
    '  float scanline = pow(sin(uv.y * 800.0 + t * 10.0) * 0.5 + 0.5, 1.5);',
    '  color *= 1.0 - scanline * uScanlines * 0.15;',
    '  float hLine = step(0.98, sin(uv.y * 300.0) * 0.5 + 0.5);',
    '  color *= 1.0 - hLine * uScanlines * 0.1;',
    '',
    '  // === RANDOM GLITCH BLOCKS ===',
    '  float blockNoise = rand(vec2(floor(uv.y * 20.0), floor(t * 10.0)));',
    '  if (blockNoise > 1.0 - uGlitchBlocks * 0.15) {',
    '    float bOff  = (rand(vec2(floor(t * 30.0), floor(uv.y * 20.0))) - 0.5)',
    '                  * 0.1 * uGlitchBlocks;',
    '    color = texture2D(uTexture, vec2(uv.x + bOff, uv.y)).rgb;',
    '  }',
    '',
    '  // === FILM GRAIN ===',
    '  float grain = rand(uv + fract(t)) * 0.05 * uGrain;',
    '  color += grain - 0.025 * uGrain;',
    '',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  /* ── Bootstrap ─────────────────────────────────────────────────── */
  function init() {
    var canvas = document.getElementById('vhs-canvas');
    var slide  = document.getElementById('slide-cover');
    if (!canvas || !slide || typeof THREE === 'undefined') return;

    var W = slide.offsetWidth;
    var H = slide.offsetHeight;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);

    var scene  = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* Load the background texture */
    new THREE.TextureLoader().load('assets/bg-texture.webp', function (tex) {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.flipY = false; /* flip handled in vertex shader */

      var uniforms = {
        uTexture:      { value: tex  },
        uTime:         { value: 0.0  },
        /* — Efecto defaults from the export — */
        uGrain:        { value: 0.4  },
        uGlitchBlocks: { value: 0.5  },
        uRgbShift:     { value: 1.45 },
        uScanlines:    { value: 0.85 },
        uNoise:        { value: 0.3  },
        uDistortion:   { value: 0.85 },
        uSpeed:        { value: 0.6  },
      };

      var mat  = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms });
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      scene.add(mesh);

      /* ── Render loop ─────────────────────────────────────────── */
      var lastTs = 0;
      var rafId  = null;
      var active = true;

      function tick(ts) {
        if (!active) { rafId = null; return; }
        var delta = Math.min((ts - lastTs) / 1000.0, 0.05);
        lastTs = ts;
        uniforms.uTime.value += delta;
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(function (ts) { lastTs = ts; tick(ts); });

      /* ── Pause when hero scrolls out of view (saves GPU) ─────── */
      var visObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          active = e.isIntersecting;
          if (active && !rafId) {
            rafId = requestAnimationFrame(function (ts) { lastTs = ts; tick(ts); });
          }
        });
      }, { threshold: 0 });
      visObs.observe(slide);

      /* ── Resize ──────────────────────────────────────────────── */
      window.addEventListener('resize', function () {
        var nW = slide.offsetWidth;
        var nH = slide.offsetHeight;
        renderer.setSize(nW, nH);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
