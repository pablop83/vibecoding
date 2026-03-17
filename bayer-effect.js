/**
 * Bayer Dithering Background — Hero Section
 * Adapted from Codrops / Bayer Dithering tutorial by zavalit
 * https://tympanus.net/codrops/2025/07/30/interactive-webgl-backgrounds-a-quick-guide-to-bayer-dithering/
 *
 * Personalizations vs the original:
 *   • Two-colour only: black (#000) background + #F4C4FA pink pixels
 *   • Interaction driven by mouse-move (hover), not click
 *   • Additive Gaussian metaballs: trail blobs merge liquidly as the cursor moves
 *   • Cursor leaves a dense, slow-fading blob trail (liquid dither feel)
 *   • Slow fBm base keeps the background subtly alive when the cursor is away
 */

(function () {
  'use strict';

  /* ── Vertex shader (GLSL 3 — minimal passthrough) ──────────────── */
  var VERT = [
    'void main() {',
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  /* ── Fragment shader (GLSL 3) ──────────────────────────────────── */
  var FRAG = [
    'precision highp float;',
    '',
    'uniform vec3  uColor;',
    'uniform vec2  uResolution;',
    'uniform float uTime;',
    'uniform float uPixelSize;',
    'uniform vec2  uMouse;       // live cursor pos, WebGL origin (Y-flipped)',
    'uniform float uMouseActive; // 0–1, lerped for smooth enter/leave',
    '',
    'const int MAX_TRAIL = 24;',
    'uniform vec2  uTrailPos[MAX_TRAIL];',
    'uniform float uTrailTimes[MAX_TRAIL];',
    '',
    'out vec4 fragColor;',
    '',
    '// ── Bayer 8×8 threshold (recursive analytic) ───────────────────',
    'float Bayer2(vec2 a) {',
    '  a = floor(a);',
    '  return fract(a.x / 2.0 + a.y * a.y * 0.75);',
    '}',
    '#define Bayer4(a) (Bayer2(0.5*(a))*0.25 + Bayer2(a))',
    '#define Bayer8(a) (Bayer4(0.5*(a))*0.25 + Bayer2(a))',
    '',
    '// ── Value noise helpers (for fBm) ──────────────────────────────',
    'float hash11(float n) { return fract(sin(n) * 43758.5453); }',
    '',
    'float vnoise(vec3 p) {',
    '  vec3 ip = floor(p), fp = fract(p);',
    '  float n000=hash11(dot(ip+vec3(0,0,0),vec3(1,57,113)));',
    '  float n100=hash11(dot(ip+vec3(1,0,0),vec3(1,57,113)));',
    '  float n010=hash11(dot(ip+vec3(0,1,0),vec3(1,57,113)));',
    '  float n110=hash11(dot(ip+vec3(1,1,0),vec3(1,57,113)));',
    '  float n001=hash11(dot(ip+vec3(0,0,1),vec3(1,57,113)));',
    '  float n101=hash11(dot(ip+vec3(1,0,1),vec3(1,57,113)));',
    '  float n011=hash11(dot(ip+vec3(0,1,1),vec3(1,57,113)));',
    '  float n111=hash11(dot(ip+vec3(1,1,1),vec3(1,57,113)));',
    '  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);',
    '  return mix(mix(mix(n000,n100,w.x),mix(n010,n110,w.x),w.y),',
    '             mix(mix(n001,n101,w.x),mix(n011,n111,w.x),w.y),w.z)*2.0-1.0;',
    '}',
    '',
    'float fbm(vec2 uv, float t) {',
    '  vec3 p = vec3(uv * 4.0, t);',
    '  float s=1.0, a=1.0, f=1.0;',
    '  for (int i=0;i<5;i++) { s+=a*vnoise(p*f); f*=1.25; a*=1.0; }',
    '  return s * 0.5 + 0.5;',
    '}',
    '',
    'void main() {',
    '  float ps   = uPixelSize;',
    '  vec2  fc   = gl_FragCoord.xy - uResolution * 0.5;',
    '  float ar   = uResolution.x / uResolution.y;',
    '',
    '  // Cell coords — each 8×8 Bayer block samples the same feed value',
    '  float cps  = 8.0 * ps;',
    '  vec2  cid  = floor(fc / cps);',
    '  vec2  cuv  = cid * cps / uResolution * vec2(ar, 1.0);',
    '',
    '  // ── Base feed: slow fBm (almost-dark, subtle ambient flicker) ─',
    '  float feed = fbm(cuv, uTime * 0.04) * 0.4 - 0.72;',
    '',
    '  // ── Additive metaball blobs from cursor trail ───────────────',
    '  // Each trail point is a Gaussian blob. Nearby blobs add up →',
    '  // their overlap region exceeds the dither threshold → solid fill.',
    '  // This makes blobs merge/flow like liquid as the cursor moves.',
    '  float trail = 0.0;',
    '  for (int i = 0; i < MAX_TRAIL; i++) {',
    '    vec2 pos = uTrailPos[i];',
    '    if (pos.x < -9999.0) continue;',
    '    vec2  tuv = ((pos - uResolution*0.5) / uResolution) * vec2(ar, 1.0);',
    '    float age = max(uTime - uTrailTimes[i], 0.0);',
    '    float d   = distance(cuv, tuv);',
    '    // Blob: Gaussian in space, exponential decay in time',
    '    trail += exp(-d * 12.0) * exp(-age * 0.45);',
    '  }',
    '  trail = clamp(trail, 0.0, 1.0);',
    '  feed  = max(feed, trail);',
    '',
    '  // ── Live cursor: tight leading blob (always at front of trail)',
    '  vec2  muv      = ((uMouse - uResolution*0.5) / uResolution) * vec2(ar, 1.0);',
    '  float mdist    = distance(cuv, muv);',
    '  float cursor   = exp(-mdist * 12.0) * 1.1 * uMouseActive;',
    '  feed = max(feed, cursor);',
    '',
    '  // ── Bayer8 ordered dithering → binary mask ─────────────────',
    '  float bayer = Bayer8(fc / ps) - 0.5;',
    '  float bw    = step(0.5, feed + bayer);',
    '',
    '  fragColor = vec4(uColor, bw);',
    '}'
  ].join('\n');

  /* ── Factory ─────────────────────────────────────────────────────── */
  function initBayer(slideId, canvasId, blobColor) {
    var slide = document.getElementById(slideId);
    if (!slide || typeof THREE === 'undefined') return;

    /* Create & insert canvas as first child */
    var canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    slide.insertBefore(canvas, slide.firstChild);

    var W = slide.offsetWidth;
    var H = slide.offsetHeight;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(1); /* 1:1 keeps dithering pixels sharp at native size */
    renderer.setSize(W, H);

    var scene  = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* ── Uniforms ─────────────────────────────────────────────────── */
    var MAX_TRAIL  = 24;
    var trailPos   = [];
    var trailTimes = new Float32Array(MAX_TRAIL);
    for (var i = 0; i < MAX_TRAIL; i++) trailPos.push(new THREE.Vector2(-99999, -99999));

    var uniforms = {
      uColor:       { value: new THREE.Color(blobColor) },
      uResolution:  { value: new THREE.Vector2(W, H)   },
      uTime:        { value: 0.0  },
      uPixelSize:   { value: 3.0  },
      uMouse:       { value: new THREE.Vector2(W * 0.5, H * 0.5) },
      uMouseActive: { value: 0.0  },
      uTrailPos:    { value: trailPos   },
      uTrailTimes:  { value: trailTimes },
    };

    var mat  = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: uniforms,
      transparent: true,
      glslVersion: THREE.GLSL3,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    /* ── Render loop ─────────────────────────────────────────────── */
    var lastTs       = 0;
    var targetActive = 0.0;
    var active       = true;

    function tick(ts) {
      if (!active) return;
      var delta = Math.min((ts - lastTs) / 1000.0, 0.05);
      lastTs = ts;
      uniforms.uTime.value += delta;
      /* Smooth mouse-active fade (lerp toward 0 or 1 each frame) */
      uniforms.uMouseActive.value += (targetActive - uniforms.uMouseActive.value) * 0.08;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(function (ts) { lastTs = ts; tick(ts); });

    /* ── Pause when hero is out of view ─────────────────────────── */
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        active = e.isIntersecting;
        if (active) requestAnimationFrame(function (ts) { lastTs = ts; tick(ts); });
      });
    }, { threshold: 0 }).observe(slide);

    /* ── Mouse tracking ──────────────────────────────────────────── */
    var rect       = slide.getBoundingClientRect();
    var trailIdx   = 0;
    var lastBlobTs = 0;

    slide.addEventListener('mousemove', function (e) {
      rect = slide.getBoundingClientRect();
      /* Convert to WebGL pixel coords (Y-flipped) */
      var fx = (e.clientX - rect.left)  * (W / rect.width);
      var fy = (rect.height - (e.clientY - rect.top)) * (H / rect.height);

      /* Update live cursor blob */
      uniforms.uMouse.value.set(fx, fy);
      targetActive = 1.0;

      /* Spawn a trail blob every ~25 ms — dense enough to merge into liquid */
      var now = performance.now();
      if (now - lastBlobTs > 25) {
        lastBlobTs = now;
        uniforms.uTrailPos.value[trailIdx].set(fx, fy);
        uniforms.uTrailTimes.value[trailIdx] = uniforms.uTime.value;
        trailIdx = (trailIdx + 1) % MAX_TRAIL;
      }
    });

    slide.addEventListener('mouseleave', function () { targetActive = 0.0; });

    /* ── Resize ──────────────────────────────────────────────────── */
    window.addEventListener('resize', function () {
      W = slide.offsetWidth; H = slide.offsetHeight;
      renderer.setSize(W, H);
      uniforms.uResolution.value.set(W, H);
      uniforms.uMouse.value.set(W * 0.5, H * 0.5);
    });
  }

  function init() {
    initBayer('slide-cover',  'bayer-canvas',        '#F4C4FA');
    initBayer('slide-thanks', 'bayer-canvas-thanks', '#000000');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
