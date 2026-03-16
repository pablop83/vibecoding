(function () {
  'use strict';

  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+*#@!?';
  var PRELOADER_TEXT = 'AI/BRANDING';

  /* ── Scramble utility ───────────────────────────────────────────────
   * Given an array of <span> elements and the target text array,
   * rapidly cycles each char through random characters before settling.
   * Returns a Promise that resolves when all chars have settled.
   */
  /* opts: { ms, base, mult, rand } — controls speed and stagger
   * Defaults (fast, for preloader): ms=42, base=6, mult=1.8, rand=5
   * Slow (for H1 title):            ms=70, base=10, mult=3.5, rand=8  */
  function scramble(spans, targetChars, opts) {
    var ms   = (opts && opts.ms)   || 42;
    var base = (opts && opts.base) || 6;
    var mult = (opts && opts.mult) || 1.8;
    var rand = (opts && opts.rand) || 5;

    return new Promise(function (resolve) {
      var settled = 0;
      var toSettle = 0;

      spans.forEach(function (span, i) {
        var target = targetChars[i] || '';
        if (target === ' ') { settled++; return; }
        toSettle++;

        var iter = 0;
        var maxIter = base + Math.floor(i * mult + Math.random() * rand);
        var iv = setInterval(function () {
          iter++;
          if (iter >= maxIter) {
            span.textContent = target;
            span.classList.remove('scramble-dud');
            clearInterval(iv);
            settled++;
            if (settled >= spans.length) resolve();
          } else {
            span.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
            span.classList.add('scramble-dud');
          }
        }, ms);
      });

      if (toSettle === 0) resolve();
    });
  }

  /* ── Build character spans from a string ─────────────────────────── */
  function makeSpans(text) {
    return text.split('').map(function (ch) {
      var s = document.createElement('span');
      s.className = ch === ' ' ? 'scramble-char scramble-space' : 'scramble-char';
      if (ch === ' ') s.innerHTML = '&nbsp;';
      else s.textContent = '\u00A0'; /* start blank */
      return s;
    });
  }

  /* ── H1 scramble reveal ──────────────────────────────────────────────
   * Replaces .cover-title text with fixed-width spans (width measured
   * from the natural character size) so layout never shifts while random
   * chars cycle through each slot before settling on the real letter.
   */
  function initTitleReveal() {
    var title = document.querySelector('.cover-title');
    if (!title) return;
    var original = title.textContent.trim();
    var chars    = original.split('');

    /* Measure each character's natural width */
    var measurer = document.createElement('span');
    measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;';
    title.appendChild(measurer);

    var widths = chars.map(function (ch) {
      measurer.textContent = ch === ' ' ? '\u00A0' : ch;
      return measurer.getBoundingClientRect().width;
    });
    title.removeChild(measurer);

    /* Build fixed-width character spans grouped into word wrappers.
     * Each word gets display:inline-block + white-space:nowrap so the
     * browser can still wrap between words but never splits a word mid-char. */
    var allCharSpans = [];
    title.textContent = '';

    var wordWrapper = null;

    chars.forEach(function (ch, i) {
      if (ch === ' ') {
        /* Use a real text-node space so the browser treats it as a
           normal word-wrap opportunity between inline-block word groups */
        wordWrapper = null;
        title.appendChild(document.createTextNode(' '));
      } else {
        /* Start a new word wrapper when needed */
        if (!wordWrapper) {
          wordWrapper = document.createElement('span');
          wordWrapper.style.cssText = 'display:inline-block;white-space:nowrap;';
          title.appendChild(wordWrapper);
        }
        var s = document.createElement('span');
        s.className   = 'scramble-char scramble-dud';
        s.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
        s.style.display   = 'inline-block';
        s.style.width     = widths[i] + 'px';
        s.style.textAlign = 'center';
        wordWrapper.appendChild(s);
        allCharSpans.push({ span: s, target: ch });
      }
    });

    /* Run scramble using the collected char spans */
    /* Slow stagger so each word settles visibly (~3s total) */
    scramble(
      allCharSpans.map(function (o) { return o.span; }),
      allCharSpans.map(function (o) { return o.target; }),
      { ms: 40, base: 5, mult: 2.0, rand: 6 }
    );
  }

  /* ── Two-phase preloader ─────────────────────────────────────────────
   *
   * Skipped automatically after the first run within a browser session
   * (sessionStorage flag), so reloading the page goes straight to the
   * hero without waiting. Close the tab and reopen to see it again.
   *
   * Phase 1 (preloaderPhase1Promise): scramble has settled.
   *   → hero-effect.js inits its canvas and renders a solid black frame
   *     behind the preloader, so when the preloader fades there is no
   *     flash of raw hero HTML.
   *
   * Phase 2 (preloaderPromise): preloader overlay is fully gone.
   *   → hero-effect.js starts the pixel-reveal animation.
   */
  var resolvePhase1;
  window.preloaderPhase1Promise = new Promise(function (r) { resolvePhase1 = r; });

  window.preloaderPromise = new Promise(function (resolvePreloader) {

    function buildAndStart() {

      var overlay = document.createElement('div');
      overlay.id = 'preloader';

      var textEl = document.createElement('p');
      textEl.className = 'preloader-text';
      overlay.appendChild(textEl);
      document.body.appendChild(overlay);

      var spans = makeSpans(PRELOADER_TEXT);
      spans.forEach(function (s) { textEl.appendChild(s); });

      /* Small delay so first paint renders, then scramble in */
      setTimeout(function () {
        scramble(spans, PRELOADER_TEXT.split('')).then(function () {

          /* Phase 1 resolved — hero canvas can now go black behind us */
          resolvePhase1();

          /* Hold for 700ms, then fade out */
          setTimeout(function () {
            overlay.style.opacity = '0';
            /* Phase 2 resolves once overlay is fully invisible */
            setTimeout(function () {
              overlay.style.display = 'none';
              resolvePreloader();
            }, 600);
          }, 700);
        });
      }, 120);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildAndStart);
    } else {
      buildAndStart();
    }
  });

  /* ── Nav item hover scramble ─────────────────────────────────────────
   * Wraps each .nav-item's text in char spans so hovering triggers a
   * quick scramble that settles back to the original label.
   */
  function initNavScramble() {
    var menu = document.querySelector('.nav-menu');
    if (!menu) return;

    /* ── Sliding indicator ──────────────────────────────────────────────
     * One absolutely-positioned div that glides to whichever item is
     * active or hovered, then snaps back to the pinned active item when
     * the cursor leaves the nav.
     */
    var indicator  = document.createElement('div');
    indicator.className = 'nav-indicator';
    menu.insertBefore(indicator, menu.firstChild);

    var pinnedItem = menu.querySelector('.nav-item.active'); /* the "real" active item */

    function moveIndicatorTo(item, instant) {
      var menuRect = menu.getBoundingClientRect();
      var itemRect = item.getBoundingClientRect();
      if (instant) {
        /* Suppress transition for the initial placement */
        indicator.style.transition = 'none';
        indicator.getBoundingClientRect(); /* force reflow */
      }
      indicator.style.left   = (itemRect.left - menuRect.left)  + 'px';
      indicator.style.top    = (itemRect.top  - menuRect.top)   + 'px';
      indicator.style.width  = itemRect.width  + 'px';
      indicator.style.height = itemRect.height + 'px';
      if (instant) {
        indicator.getBoundingClientRect(); /* flush */
        indicator.style.transition = ''; /* restore CSS transition */
      }
    }

    /* Place indicator on the active item immediately (no animation) */
    if (pinnedItem) moveIndicatorTo(pinnedItem, true);

    /* Return indicator to pinned item when cursor leaves the whole menu */
    menu.addEventListener('mouseleave', function () {
      if (pinnedItem) moveIndicatorTo(pinnedItem);
    });

    /* ── Per-item setup ─────────────────────────────────────────────── */
    var items = menu.querySelectorAll('.nav-item');
    items.forEach(function (item) {
      var original = item.textContent.trim();
      var chars    = original.split('');
      var spans    = [];
      var busy     = false;

      /* Measure natural width of each character so random chars that
         cycle through never cause layout shift (fixed-width slots). */
      var measurer = document.createElement('span');
      measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;';
      item.appendChild(measurer);

      var widths = chars.map(function (ch) {
        measurer.textContent = ch === ' ' ? '\u00A0' : ch;
        return measurer.getBoundingClientRect().width;
      });
      item.removeChild(measurer);

      /* Lock item width so the nav bar never reflows */
      item.style.width = item.getBoundingClientRect().width + 'px';

      /* Replace text with fixed-width char spans */
      item.textContent = '';
      chars.forEach(function (ch, i) {
        var s = document.createElement('span');
        s.className       = 'scramble-char';
        s.style.display   = 'inline-block';
        s.style.width     = widths[i] + 'px';
        s.style.textAlign = 'center';
        s.textContent     = ch === ' ' ? '\u00A0' : ch;
        item.appendChild(s);
        spans.push(s);
      });

      var scrambleTimer = null;

      item.addEventListener('mouseenter', function () {
        /* Slide indicator to this item immediately */
        moveIndicatorTo(item);

        /* Wait for the pill to arrive (~150ms) before scrambling */
        clearTimeout(scrambleTimer);
        scrambleTimer = setTimeout(function () {
          if (busy) return;
          busy = true;
          spans.forEach(function (s, i) {
            if (chars[i] !== ' ') {
              s.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
              s.classList.add('scramble-dud');
            }
          });
          scramble(spans, chars, { ms: 35, base: 3, mult: 1.2, rand: 3 })
            .then(function () { busy = false; });
        }, 150);
      });

      /* Cancel pending scramble if cursor leaves before pill settles */
      item.addEventListener('mouseleave', function () {
        clearTimeout(scrambleTimer);
      });

      /* Clicking pins the active item to the one clicked */
      item.addEventListener('click', function () {
        if (pinnedItem) pinnedItem.classList.remove('active');
        pinnedItem = item;
        item.classList.add('active');
      });
    });
  }

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavScramble);
  } else {
    initNavScramble();
  }

  /* Expose so hero-effect.js can call it at exactly the right moment */
  window._initTitleReveal = initTitleReveal;

}());
