// Nav active state on scroll
const navItems = document.querySelectorAll('.nav-item');
const slides   = document.querySelectorAll('.slide');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && entry.target.id === 'slide-cover') {
      navItems.forEach(n => n.classList.remove('active'));
      navItems[0]?.classList.add('active');
    }
    if (entry.isIntersecting && (entry.target.id === 'slide-cambio' || entry.target.id === 'slide-paradigma-text' || entry.target.id === 'slide-paradigma-cards')) {
      navItems.forEach(n => n.classList.remove('active'));
      navItems[0]?.classList.add('active');
    }
    if (entry.isIntersecting && (entry.target.id === 'slide-quote' || entry.target.id === 'slide-rol')) {
      navItems.forEach(n => n.classList.remove('active'));
      navItems[1]?.classList.add('active');
    }
    if (entry.isIntersecting && entry.target.id === 'slide-process') {
      navItems.forEach(n => n.classList.remove('active'));
      navItems[2]?.classList.add('active');
    }
  });
}, { threshold: 0.4 });

slides.forEach(s => observer.observe(s));

// ── Cambio cards entrance animation ──────────────────────────────────
// Fires once when #slide-cambio reaches 35% visibility.
// Adds .cards-visible → CSS transitions stagger the 3 cards in.
(function () {
  var slide = document.getElementById('slide-cambio');
  if (!slide) return;

  var cardObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        slide.classList.add('cards-visible');
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: [0.5] });

  // Observe the cards container itself — fires when the cards are 50% in view
  var cards = slide.querySelector('.cambio-cards');
  setTimeout(function () { cardObserver.observe(cards || slide); }, 100);
}());


// ── Brand cards entrance animation ───────────────────────────────────
(function () {
  var slide = document.getElementById('slide-paradigma-cards');
  if (!slide) return;

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
        slide.classList.add('brand-cards-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: [0.4] });

  var container = slide.querySelector('.brand-cards-container');
  setTimeout(function () { obs.observe(container || slide); }, 100);
}());

// ── Thanks letters reveal ─────────────────────────────────────────────
// Sets clip-path + transform inline (more reliable on SVG <g> than CSS class transitions)
(function () {
  var el = document.getElementById('slide-thanks');
  if (!el) return;

  var letters = el.querySelectorAll('.thanks-letter');
  var TRANSITION = 'clip-path 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
  var STAGGER_MS = 80;

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
        letters.forEach(function (letter, i) {
          setTimeout(function () {
            letter.style.transition = TRANSITION;
            letter.style.clipPath   = 'inset(0 0 0% 0)';
            letter.style.transform  = 'translateY(0)';
          }, i * STAGGER_MS);
        });
        obs.unobserve(el);
      }
    });
  }, { threshold: [0.55] });

  setTimeout(function () { obs.observe(el); }, 100);
}());

// ── Scroll-driven border progress ────────────────────────────────────
// Sets --bp (0→1) on each header element as the user scrolls it into view.
// ::before pseudo-elements use width: calc(var(--bp) * 100%);
// .process-divider uses transform: scaleX(var(--bp)).
(function () {
  // Collect [element, scrollRangeMultiplier]
  // Range: border starts growing when el.top == vh, finishes when el.top == vh * (1 - rangeMult)
  var targets = [];

  function addHeader(selector, slideId) {
    var slide = document.getElementById(slideId);
    if (!slide) return;
    var el = slide.querySelector(selector);
    if (el) targets.push({ el: el, offset: 0 });
  }

  addHeader('.paradigma-cards-header', 'slide-paradigma-cards');
  addHeader('.quote-header',           'slide-quote');
  addHeader('.rol-header',             'slide-rol');

  // Process dividers: set --bp directly on each divider element
  var slideProcess = document.getElementById('slide-process');
  if (slideProcess) {
    slideProcess.querySelectorAll('.process-divider').forEach(function (d, i) {
      targets.push({ el: d, offset: i * 0.08 }); // slight stagger between top/bottom
    });
  }

  function update() {
    var vh = window.innerHeight;
    targets.forEach(function (t) {
      var rect = t.el.getBoundingClientRect();
      // Progress: 0 when top of element hits bottom of viewport,
      //           1 when top of element reaches 55% up the viewport
      var raw = (vh - rect.top) / (vh * 0.45) - t.offset;
      var bp  = Math.max(0, Math.min(1, raw));
      t.el.style.setProperty('--bp', bp);
    });
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}());

// ── Rol diagram: cursor following (replicates GSAP stagger technique) ────────
// Each group tweens to the cursor position with a staggered start, using
// power3.out easing — same as gsap.to(els, { stagger: 0.15, ease: 'power3.out' })
(function () {
  var diagram = document.querySelector('.rol-diagram');
  if (!diagram) return;

  var DURATION_MS = 500;
  var STAGGER_MS  = 60;

  // Stagger order: fastest/first → slowest/last
  var GROUPS = [
    { tag: '.rol-tag-developer',    arrow: '.rol-arrow-developer',    stagger: 0 },
    { tag: '.rol-tag-copywriter',   arrow: '.rol-arrow-copywriter',   stagger: 1 },
    { tag: '.rol-tag-researcher',   arrow: '.rol-arrow-researcher',   stagger: 2 },
    { tag: '.rol-tag-photographer', arrow: '.rol-arrow-photographer', stagger: 3 },
  ];

  // power3.out easing
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  var groups = GROUPS.map(function (g) {
    return {
      tag:   diagram.querySelector(g.tag),
      arrow: diagram.querySelector(g.arrow),
      delayMs:   g.stagger * STAGGER_MS,
      x: 0, y: 0,   // current rendered position
      sx: 0, sy: 0, // tween start position
      tx: 0, ty: 0, // tween target position
      fireAt:    -1,
      startTime: -1,
    };
  });

  var raf = null;

  function triggerTween(cx, cy) {
    var now = performance.now();
    groups.forEach(function (g) {
      g.tx = cx; g.ty = cy;
      g.sx = g.x; g.sy = g.y;
      g.startTime = -1;
      g.fireAt = now + g.delayMs;
    });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  diagram.addEventListener('mousemove', function (e) {
    var r = diagram.getBoundingClientRect();
    triggerTween(e.clientX - r.left - r.width * 0.5,
                 e.clientY - r.top  - r.height * 0.5);
  });

  diagram.addEventListener('mouseleave', function () { triggerTween(0, 0); });

  function tick(now) {
    var allDone = true;
    groups.forEach(function (g) {
      if (g.fireAt < 0) return;
      if (now < g.fireAt) { allDone = false; return; }
      if (g.startTime < 0) { g.startTime = now; g.sx = g.x; g.sy = g.y; }

      var t  = Math.min((now - g.startTime) / DURATION_MS, 1.0);
      var et = ease(t);
      g.x = g.sx + (g.tx - g.sx) * et;
      g.y = g.sy + (g.ty - g.sy) * et;

      var tr = 'translate(' + g.x.toFixed(2) + 'px,' + g.y.toFixed(2) + 'px)';
      if (g.tag)   g.tag.style.transform = tr;
      if (g.arrow) g.arrow.style.transform = tr;

      if (t < 1.0) allDone = false;
    });
    raf = allDone ? null : requestAnimationFrame(tick);
  }
}());

// Nav click smooth scroll
const slideMap = {
  0: 'slide-cambio',
  1: 'slide-rol',
  2: 'slide-process',
  3: 'slide-process',
};

navItems.forEach((item, i) => {
  item.addEventListener('click', () => {
    const target = document.getElementById(slideMap[i]);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
