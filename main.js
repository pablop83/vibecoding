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

  // Use Lenis scroll event if available (syncs with smoothed position),
  // fall back to native scroll for safety
  function bindScroll() {
    if (window.lenis) {
      window.lenis.on('scroll', update);
    } else {
      window.addEventListener('scroll', update, { passive: true });
    }
  }
  // Lenis is initialised after this script, so wait one tick
  setTimeout(bindScroll, 0);
  window.addEventListener('resize', update, { passive: true });
  update();
}());

// ── Rol diagram: cursor following (quickTo-style continuous lerp) ─────────────
// Each element has its own lerp factor — faster = closer to cursor.
// Every frame: x += (target - x) * factor  →  replicates gsap.quickTo behaviour.
(function () {
  var slide   = document.getElementById('slide-rol');
  var diagram = document.querySelector('.rol-diagram');
  if (!slide || !diagram) return;

  // All elements chase the cursor directly — different speeds create the trail.
  var GROUPS = [
    { tag: '.rol-tag-developer',    arrow: '.rol-arrow-developer',    factor: 0.02 },
    { tag: '.rol-tag-copywriter',   arrow: '.rol-arrow-copywriter',   factor: 0.013 },
    { tag: '.rol-tag-researcher',   arrow: '.rol-arrow-researcher',   factor: 0.008 },
    { tag: '.rol-tag-photographer', arrow: '.rol-arrow-photographer', factor: 0.004 },
  ];

  // Capture each tag's natural center position relative to the diagram center.
  // This is the offset we need to subtract so translate(tx,ty)=0 means "at cursor".
  var groups = GROUPS.map(function (g) {
    var tagEl   = diagram.querySelector(g.tag);
    var arrowEl = diagram.querySelector(g.arrow);
    var naturalX = 0, naturalY = 0;
    if (tagEl) {
      var dr  = diagram.getBoundingClientRect();
      var tr  = tagEl.getBoundingClientRect();
      naturalX = (tr.left + tr.width  * 0.5) - (dr.left + dr.width  * 0.5);
      naturalY = (tr.top  + tr.height * 0.5) - (dr.top  + dr.height * 0.5);
    }
    return {
      tag: tagEl, arrow: arrowEl,
      factor: g.factor,
      naturalX: naturalX, naturalY: naturalY,
      x: 0, y: 0,
      tx: 0, ty: 0,
    };
  });

  var raf       = null;
  var inside    = false;
  var enterTime = 0;        // timestamp when cursor entered the section
  var DELAY_MS  = 1000;     // wait 1 s before elements start following

  document.addEventListener('mousemove', function (e) {
    var r        = slide.getBoundingClientRect();
    var isInside = e.clientX >= r.left && e.clientX <= r.right &&
                   e.clientY >= r.top  && e.clientY <= r.bottom;

    if (isInside) {
      if (!inside) {
        inside    = true;
        enterTime = performance.now(); // record when we entered
      }

      // Only start following after the 2 s delay has passed
      if (performance.now() - enterTime >= DELAY_MS) {
        var dr = diagram.getBoundingClientRect();
        var cx = e.clientX - (dr.left + dr.width  * 0.5);
        var cy = e.clientY - (dr.top  + dr.height * 0.5);
        groups.forEach(function (g) {
          g.tx = cx - g.naturalX;
          g.ty = cy - g.naturalY;
        });
      }
    } else if (inside) {
      groups.forEach(function (g) { g.tx = 0; g.ty = 0; });
      inside = false;
    } else {
      return;
    }

    if (!raf) raf = requestAnimationFrame(tick);
  });

  function tick() {
    var settled = true;
    groups.forEach(function (g) {
      g.x += (g.tx - g.x) * g.factor;
      g.y += (g.ty - g.y) * g.factor;
      var tr = 'translate(' + g.x.toFixed(2) + 'px,' + g.y.toFixed(2) + 'px)';
      if (g.tag)   g.tag.style.transform = tr;
      if (g.arrow) g.arrow.style.transform = tr;
      if (Math.abs(g.tx - g.x) > 0.3 || Math.abs(g.ty - g.y) > 0.3) settled = false;
    });
    raf = settled ? null : requestAnimationFrame(tick);
  }
}());

// ── Rol tags: idle random scramble ───────────────────────────────────────────
// Each role-tag text scrambles to random chars then resolves back, independently
// and at random intervals so they feel organic rather than choreographed.
(function () {
  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@&%';
  var TAGS  = ['.rol-tag-researcher', '.rol-tag-developer',
               '.rol-tag-photographer', '.rol-tag-copywriter'];

  function randChar() {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  function scrambleTag(el, original) {
    var chars  = original.split('');
    var iters  = 0;
    var maxIter = chars.length + 4;
    var frame;

    function step() {
      iters++;
      var out = chars.map(function (ch, i) {
        // Letters settle one by one from left to right
        if (i < iters - 4) return ch;
        return ch === ' ' ? ' ' : randChar();
      }).join('');
      el.textContent = out;
      if (iters <= maxIter) {
        frame = setTimeout(step, 45);
      } else {
        el.textContent = original; // fully resolved
        scheduleNext(el, original);
      }
    }
    step();
  }

  function scheduleNext(el, original) {
    // Random pause between 3 and 9 seconds before next scramble
    var delay = 3000 + Math.random() * 6000;
    setTimeout(function () { scrambleTag(el, original); }, delay);
  }

  TAGS.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    var original = el.textContent.trim();
    // Stagger initial scramble so they don't all fire at once
    var initDelay = Math.random() * 4000;
    setTimeout(function () { scrambleTag(el, original); }, initDelay);
  });
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
    if (!target) return;
    // Use Lenis for smooth scroll if available, otherwise fall back
    if (window.lenis) {
      window.lenis.scrollTo(target, { duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
