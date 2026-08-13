/* ============================================================
   HMC OS motion layer
   ------------------------------------------------------------
   Rules this file follows:
   1. Nothing is hidden by CSS alone. The .motion class is added to <html>
      only when GSAP is present and the visitor has not asked for reduced
      motion, so a failed script or a reduced-motion setting leaves a
      complete, readable page rather than a blank one.
   2. Every animation here is doing a job: naming the product, pacing the
      four opening lines, handing one tool off to the next, carrying the
      referral across the screen, or putting weight on a number. There is
      no drift for the sake of drift.
   3. Pinning is desktop only. Below 900px the CSS lays the same content
      out statically and this file only fades things in.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var desktop = window.matchMedia('(min-width: 901px)').matches;
  var doc = document.documentElement;

  /* ---------- always on, motion or not ---------- */

  // Scroll progress. A long guided page needs a sense of how far in you are.
  var bar = document.getElementById('progress');
  var topbar = document.getElementById('topbar');
  function chrome() {
    var y = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (max > 0 ? Math.min(1, Math.max(0, y / max)) * 100 : 0) + '%';
    if (topbar) topbar.classList.toggle('is-solid', y > 80);
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { chrome(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', chrome);
  chrome();

  // Anchor links ease on their own, per call, so no global smooth scrolling is
  // left switched on for ScrollTrigger to trip over.
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      // Preventing the default also cancels the focus move the browser would
      // have done, which on a page this long strands a keyboard reader back at
      // the top of the tab order. The skip link in particular does nothing at
      // all without this.
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ---------- persona switcher ----------
     The same nine tools mean different things to a resident, a volunteer, a
     partner organization and a funder. Rather than write one line and hope it
     lands for all four, each stage carries a line per persona and this swaps
     them. Choosing a persona also reorders the tour so the tools that matter
     to that reader come first.

     A funder is the exception and keeps all nine in the default order. They
     are judging whether HMC can execute at the scale they would fund, so
     completeness is the argument; a shortened cut would read as a smaller
     operation than it is.

     Nothing is removed from the DOM. Out-of-path stages are marked and pushed
     to the end, so every tool stays reachable and the page stays crawlable. */
  /* Dive order per answer. 1 Resource Directory, 2 CheckYourself,
     3 EventFinder, 4 Your CalmKit, 5 Partner Portal. Nothing is removed: the
     dives that are not on somebody's path follow underneath, so every product
     stays reachable and the page stays crawlable. */
  var PERSONA_PATHS = {
    all:       [1, 2, 3, 4, 5],
    member:    [1, 2, 3, 4],
    wellbeing: [4, 2, 3, 1],
    volunteer: [3, 1, 4, 2],
    partner:   [5, 1, 3, 2],
    funder:    [1, 2, 3, 4, 5]
  };
  var PERSONA_NOTES = {
    all:       '',
    member:    'Starting with what you need. Everything else follows underneath.',
    wellbeing: 'Starting with this moment. Everything else follows underneath.',
    volunteer: 'Starting with ways to take action. Everything else follows underneath.',
    partner:   'Starting with what your organization works with. Everything else follows underneath.',
    funder:    'Showing the full system. Every tool below is running today.'
  };
  var whoBtns = [].slice.call(document.querySelectorAll('.who-btn, .who-all'));
  var whoNote = document.getElementById('whoNote');
  var seq = document.getElementById('dives');
  var stages = [].slice.call(document.querySelectorAll('.dive'));

  if (whoBtns.length && stages.length) {
    // Remember where each stage started so "show me everything" can put the
    // tour back exactly as it was rather than approximately.
    stages.forEach(function (el, i) { el.style.order = String(i); });

    function applyPersona(key, announce) {
      var path = PERSONA_PATHS[key] || PERSONA_PATHS.all;
      var inPath = {};
      path.forEach(function (n, i) { inPath[n] = i; });

      stages.forEach(function (el) {
        var n = parseInt(el.getAttribute('data-dive'), 10);
        if (n in inPath) {
          el.classList.remove('is-aside');
          el.style.order = String(inPath[n]);
        } else {
          el.classList.add('is-aside');
          el.style.order = String(100 + n);
        }
      });

      if (seq) seq.classList.toggle('is-cut', key !== 'all' && key !== 'funder');
      whoBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-persona') === key));
      });
      if (whoNote && announce) whoNote.textContent = PERSONA_NOTES[key] || '';

      // The stages just changed order and height, so every pinned trigger built
      // against the old layout is now measuring the wrong thing.
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }

    whoBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-persona');
        applyPersona(key, true);
        var url = new URL(window.location.href);
        if (key === 'all') url.searchParams.delete('for');
        else url.searchParams.set('for', key);
        history.replaceState(null, '', url);
      });
    });

    // Deep link, so a funder or a partner can be sent straight to their cut.
    var initial = new URL(window.location.href).searchParams.get('for');
    if (initial && PERSONA_PATHS[initial]) applyPersona(initial, true);
  }



  /* ---------- deck lightbox ----------
     Cards are real links to the tool, so this only ever enhances: if the script
     fails the click still goes somewhere useful. Intercepting it lets somebody
     look through all nine without leaving the page and losing their scroll
     position, which is the whole reason the deck exists. */
  (function () {
    var lb = document.getElementById('lb');
    var grid = document.getElementById('deckGrid');
    if (!lb || !grid) return;

    var cards = [].slice.call(grid.querySelectorAll('.deck-card'));
    var img = document.getElementById('lbImg');
    var name = document.getElementById('lbName');
    var idx = document.getElementById('lbIdx');
    var open = document.getElementById('lbOpen');
    var btnClose = document.getElementById('lbClose');
    var btnPrev = document.getElementById('lbPrev');
    var btnNext = document.getElementById('lbNext');
    var stage = document.getElementById('lbStage');
    var current = 0;
    var lastFocused = null;

    function pad(n) { return ('0' + n).slice(-2); }

    function show(i) {
      current = (i + cards.length) % cards.length;
      var card = cards[current];
      var src = card.querySelector('img');
      img.src = src.getAttribute('src');
      img.alt = src.getAttribute('alt') || '';
      // Two of the nine were captured on a phone. Shown in the laptop's 16/10
      // screen they came out as the top fifth of the shot blown up to full
      // width, so the lid becomes a phone body for those instead.
      if (stage) stage.setAttribute('data-shape', card.getAttribute('data-shape') || 'browser');
      name.textContent = card.querySelector('.deck-name').textContent;
      idx.textContent = pad(current + 1) + ' / ' + pad(cards.length);
      open.href = card.getAttribute('href');
    }

    function openLb(i) {
      lastFocused = document.activeElement;
      show(i);
      lb.hidden = false;
      // Two frames so the browser paints the hidden state before transitioning.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { lb.classList.add('is-open'); });
      });
      document.documentElement.style.overflow = 'hidden';
      btnClose.focus();
    }

    function closeLb() {
      lb.classList.remove('is-open');
      document.documentElement.style.overflow = '';
      var done = function () { lb.hidden = true; lb.removeEventListener('transitionend', done); };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
      else lb.addEventListener('transitionend', done);
      if (lastFocused) lastFocused.focus();
    }

    cards.forEach(function (card, i) {
      card.addEventListener('click', function (e) {
        // Let a modified click do what the visitor asked for.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openLb(i);
      });
    });

    btnClose.addEventListener('click', closeLb);
    btnPrev.addEventListener('click', function () { show(current - 1); });
    btnNext.addEventListener('click', function () { show(current + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowLeft') show(current - 1);
      else if (e.key === 'ArrowRight') show(current + 1);
      else if (e.key === 'Tab') {
        // Keep focus inside the dialog while it is open.
        var f = [btnClose, open, btnPrev, btnNext];
        var i = f.indexOf(document.activeElement);
        if (i === -1) { e.preventDefault(); btnClose.focus(); return; }
        var next = e.shiftKey ? i - 1 : i + 1;
        if (next < 0 || next >= f.length) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      }
    });
  })();

  if (reduce || !hasGsap) return;

  doc.classList.add('motion');
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll ----------
     Lenis smooths the wheel input on desktop. It changes how scrolling feels,
     never where anything sits. Touch keeps the native scroller. */
  if (window.Lenis && desktop) {
    var lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      smoothTouch: false
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__osLenis = lenis;
  }

  /* ---------- 1. the opening ----------
     The mark arrives at full width, then hands its size over. HMC OS shrinks to
     roughly the size the promise was, and the promise grows to roughly the size
     the mark was, so the screen ends up saying the thing the reader needs
     rather than the thing we are called. Scrubbed, so the swap is the reader's
     own movement rather than something that happens at them. */
  (function hero() {
    var mark = document.getElementById('heroMark');
    var sub = document.getElementById('heroSub');
    if (!mark) return;

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(mark, { scale: 1.16, opacity: 0, duration: 1.1 })
      .from('.hero .eyebrow', { y: 14, opacity: 0, duration: 0.6 }, 0.15)
      .from(sub, { opacity: 0, duration: 0.7 }, '-=0.5')
      .from('.hero-lede', { y: 20, opacity: 0, duration: 0.8 }, '-=0.5')
      .from('.scroll-cue', { opacity: 0, duration: 0.6 }, '-=0.3');

    if (!desktop) return;

    // The swap. The two scales are picked off the two type sizes: the mark tops
    // out at 232px and the promise at 72px, so a third and a bit over three
    // times is the pair of numbers that actually trades their places.
    var swap = gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.5 }
    });
    swap.to(mark, { scale: 0.33, y: -18, duration: 1, ease: 'power2.inOut' }, 0.15)
        .fromTo(sub, { scale: 0.62 }, { scale: 1.85, duration: 1, ease: 'power2.inOut' }, 0.15)
        .to('.hero-lede', { opacity: 0, y: -14, duration: 0.4 }, 0.15)
        .to('.scroll-cue', { opacity: 0, duration: 0.3 }, 0.1)
        .to('.hero .eyebrow', { opacity: 0, duration: 0.3 }, 0.15);

    // Depth behind the swap, and the whole thing leaving at the end.
    swap.to('.hero-grid', { y: 120, duration: 1.6, ease: 'none' }, 0)
        .to('.hero-glow', { y: 190, opacity: 0.45, duration: 1.6, ease: 'none' }, 0)
        .to('.hero-inner', { opacity: 0, y: -50, duration: 0.5 }, 1.5);
  })();

  /* ---------- 2. the camera move ----------
     The prologue and the bird's eye view are one shot, not two sections. The
     reader is shown a single moment, then the points around it, then the
     pathways between them, then the environment those pathways sit in, and the
     camera pulls back through the whole thing without cutting.

     Two rules hold it together. The copy beat always changes on the same frame
     as the camera does something, so the words are never narrating a still
     picture. And depth is real: every element carries data-depth, and the pull
     back scales its travel by that depth, so near points sweep and far points
     barely move. That difference is the only reason it reads as space. */
  if (desktop) {
    var field = document.getElementById('proField');
    var proLines = gsap.utils.toArray('.pro-line');

    if (field && proLines.length) {
      var dots = gsap.utils.toArray('.pro-dot');
      var links = gsap.utils.toArray('.pro-lines line');
      var terrs = gsap.utils.toArray('.terr');

      // Starting state. One point, and nothing said. The reader is meant to
      // arrive at the thought themselves, so no copy is on screen yet.
      gsap.set(proLines, { opacity: 0, y: 24 });
      gsap.set(dots, { opacity: 0, scale: 0.2 });
      gsap.set(dots[0], { opacity: 1, scale: 1 });
      gsap.set(terrs, { opacity: 0, y: 14 });
      gsap.set(field, { scale: 1.9 });

      // A pathway is drawn, not faded. Dash the whole length and walk the
      // offset back to zero so it travels from one point to the other.
      links.forEach(function (ln) {
        var len = ln.getTotalLength ? ln.getTotalLength() : 400;
        gsap.set(ln, { attr: { 'stroke-dasharray': len, 'stroke-dashoffset': len } });
      });

      var depth = function (el) { return parseFloat(el.getAttribute('data-depth')) || 2; };

      // The sticky hold is CSS. ScrollTrigger only reads progress across it, so
      // there is no second pinning mechanism fighting the first.
      var cam = gsap.timeline({
        scrollTrigger: { trigger: '.canvas', start: 'top top', end: 'bottom bottom', scrub: 0.6 }
      });

      // 0 to 2.4. Points arrive out of the dark, one at a time, and the first
      // pathways reach between them. Silent on purpose.
      cam.to({}, { duration: 0.5 });
      dots.forEach(function (d, i) {
        if (i === 0) return;
        cam.to(d, { opacity: 1, scale: 1, duration: 0.28, ease: 'power2.out' }, 0.55 + i * 0.16);
      });
      links.slice(0, 3).forEach(function (ln, i) {
        cam.to(ln, { attr: { 'stroke-dashoffset': 0 }, duration: 0.5, ease: 'none' }, 1.0 + i * 0.2);
      });

      // 2.4. The first line lands as the camera starts pulling back, so the
      // sentence and the widening view are the same event.
      cam.fromTo(proLines[0], { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4 }, 2.4);
      cam.to(field, { scale: 0.82, duration: 1.5, ease: 'power1.inOut' }, 2.4);
      dots.forEach(function (d) {
        cam.to(d, { y: (depth(d) - 2) * 46, duration: 1.5, ease: 'power1.inOut' }, 2.4);
      });
      links.slice(3).forEach(function (ln, i) {
        cam.to(ln, { attr: { 'stroke-dashoffset': 0 }, duration: 0.55, ease: 'none' }, 2.6 + i * 0.14);
      });

      // 4.0. The system names what it lets you do. These are the five things a
      // person can actually come here for, placed in the field at their own
      // depths and arriving in depth order rather than all at once.
      terrs.forEach(function (t) {
        cam.to(t, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 4.0 + (3 - depth(t)) * 0.18);
      });

      // 5.2. The handover line, with the pathways brightening under it.
      cam.to(proLines[0], { opacity: 0, y: -24, duration: 0.3 }, 5.2)
         .fromTo(proLines[1], { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4 }, 5.4)
         .to(links, { attr: { stroke: 'rgba(160,178,255,.92)' }, duration: 0.6 }, 5.4);

      // Hold, then hand the screen on.
      cam.to({}, { duration: 0.7 });
      cam.to([field, proLines[1]], { opacity: 0, duration: 0.5 }, 6.6);
    }
  } else {
    // Phones get the field as a still diagram above the lines, so the idea still
    // arrives without a five viewport scroll trap. See the matching CSS.
    gsap.set('.pro-line', { clearProps: 'all' });
    gsap.utils.toArray('.pro-lines line').forEach(function (ln) {
      gsap.set(ln, { attr: { 'stroke-dasharray': 'none', 'stroke-dashoffset': 0 } });
    });
  }

  /* ---------- the persona map ----------
     The headline arrives split to opposite corners, then the four options come
     out of the field between them, each on its own line back to the middle.
     Scattered rather than in a row, so the choice reads as four places in one
     space instead of a menu bar. */
  if (desktop) {
    var leadA = document.querySelector('.lead-a');
    var leadB = document.querySelector('.lead-b');
    var whoWrap = document.querySelector('.who');
    var cards4 = gsap.utils.toArray('.who-btn');
    var webs = gsap.utils.toArray('.who-web line');

    if (leadA && leadB && whoWrap && cards4.length) {
      gsap.set(cards4, { opacity: 0, scale: 0.5, filter: 'blur(8px)' });
      gsap.set([leadA, leadB], { opacity: 0 });
      gsap.set(whoWrap, { pointerEvents: 'none' });
      webs.forEach(function (ln) {
        var len = ln.getTotalLength ? ln.getTotalLength() : 400;
        gsap.set(ln, { attr: { 'stroke-dasharray': len, 'stroke-dashoffset': len } });
      });

      var wt = gsap.timeline({
        scrollTrigger: { trigger: '.seq-intro-sec', start: 'top top', end: 'bottom bottom', scrub: 0.55 }
      });

      // The question, opening to the corners it will hold.
      wt.fromTo(leadA, { opacity: 0, x: -70 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' }, 0.2)
        .fromTo(leadB, { opacity: 0, x: 70 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' }, 0.5);

      // Then the lines reach out, and an option lands on the end of each.
      webs.forEach(function (ln, i) {
        wt.to(ln, { attr: { 'stroke-dashoffset': 0 }, duration: 0.5, ease: 'none' }, 1.3 + i * 0.18);
      });
      cards4.forEach(function (c, i) {
        var from = [{x:-90,y:-60},{x:90,y:-70},{x:-80,y:70},{x:90,y:80}][i];
        gsap.set(c, { x: from.x, y: from.y });
        wt.to(c, {
          opacity: 1, scale: 1, x: 0, y: 0, filter: 'blur(0px)',
          duration: 0.85, ease: 'power2.out'
        }, 1.55 + i * 0.16);
      });

      wt.call(function () { gsap.set(whoWrap, { pointerEvents: 'auto' }); }, null, 2.6);
      wt.to({}, { duration: 0.8 });
    }
  }

  /* ---------- 3. the dives ----------
     Each product is entered, not listed. Five beats, same order every time:

       1  the name arrives from a distance
       2  the world of that product assembles around it
       3  the interface comes together
       4  it says the one thing it is for
       5  the whole scene compresses back to a point

     Beat five is the reason this reads as one journey rather than five landing
     pages. The scene does not scroll away, it falls back into the distance, so
     the next product activates out of the same space the last one returned to.

     One timeline per dive owns every property on every element in it, because
     two tweens on the same property fight and the later render wins. */
  gsap.utils.toArray('.dive').forEach(function (dv) {
    var copy  = dv.querySelector('.dive-copy');
    var world = dv.querySelector('.dive-world');
    var ui    = dv.querySelector('.dive-ui');
    var close = dv.querySelector('.dive-close');
    var cta   = dv.querySelector('.dive-cta');
    var mood  = dv.getAttribute('data-mood');

    if (!desktop) {
      // Phones get the same content as an ordinary stacked block. The camera
      // needs width and a long scroll, and neither is available here.
      gsap.fromTo([copy, ui, close, cta], { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: .7, ease: 'power2.out', stagger: .08,
          scrollTrigger: { trigger: dv, start: 'top 80%', once: true } });
      return;
    }

    var words  = gsap.utils.toArray(dv.querySelectorAll('.w-word'));
    var quiet  = dv.querySelector('.w-quiet');
    var breath = dv.querySelector('.w-breath');
    var modes  = gsap.utils.toArray(dv.querySelectorAll('.w-modes li'));
    var chain  = gsap.utils.toArray(dv.querySelectorAll('.w-chain li'));
    var chips  = gsap.utils.toArray(dv.querySelectorAll('.ui-chips li'));
    var typed  = dv.querySelector('.ui-type');
    var caret  = dv.querySelector('.ui-caret');

    // Scatter the loose words of a world across their stage once, by index, so
    // the arrangement is fixed rather than reshuffling on every resize.
    words.forEach(function (w, i) {
      var cols = [10, 62, 30, 74, 6, 48, 80];
      var rows = [14, 8, 70, 46, 44, 84, 26];
      w.style.left = cols[i % cols.length] + '%';
      w.style.top  = rows[i % rows.length] + '%';
    });

    var depth = function (el) { return parseFloat(el.getAttribute('data-depth')) || 2; };

    gsap.set(copy,  { opacity: 0, scale: 0.62, y: 30 });
    gsap.set(ui,    { opacity: 0, scale: 0.9, y: 40 });
    gsap.set(close, { opacity: 0, y: 26 });
    gsap.set(cta,   { opacity: 0, y: 18 });
    if (words.length) gsap.set(words, { opacity: 0, y: 26 });
    if (quiet)  gsap.set(quiet,  { opacity: 0, y: 18 });
    if (breath) gsap.set(breath, { opacity: 0, scale: 0.7 });
    if (modes.length) gsap.set(modes, { opacity: 0, y: 12 });
    if (chain.length) gsap.set(chain, { opacity: 0, y: 18 });
    if (chips.length) gsap.set(chips, { opacity: 0, y: 10 });
    if (typed) gsap.set(typed, { opacity: 0 });

    var tl = gsap.timeline({
      scrollTrigger: { trigger: dv, start: 'top top', end: 'bottom bottom', scrub: 0.6 }
    });

    /* Timing rule for the whole dive: a beat is fully gone before the next one
       arrives. Two beats sharing the screen is what made the words read as one
       pile of text on top of another. Where a world sits in the middle of the
       frame rather than out at the edges, the copy leaves before it appears. */
    var centred = (mood === 'checkin' || mood === 'calm' || mood === 'build');

    // 1. Arrival. Coming up from small is the camera closing the distance.
    tl.to(copy, { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.1);
    if (centred) tl.to(copy, { opacity: 0, y: -30, duration: 0.45 }, 1.5);

    // 2. The world. Every product gets its own, because "a world assembles"
    //    means nothing if all five assemble the same way.
    if (words.length) {
      words.forEach(function (w, i) {
        tl.to(w, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.7 + i * 0.12);
        tl.to(w, { y: (depth(w) - 2) * -34, duration: 2.2, ease: 'none' }, 0.7 + i * 0.12);
      });
      var dom = dv.querySelector('.w-word.is-dominant');
      if (dom) tl.to(dom, { scale: 1.5, duration: 0.5, ease: 'power2.out' }, 1.8);
    }
    if (quiet)  tl.to(quiet,  { opacity: 1, y: 0, duration: 0.6 }, 2.05);
    if (breath) {
      // One complete breath, held long enough to actually follow.
      tl.to(breath, { opacity: 1, scale: 1, duration: 0.7 }, 2.05)
        .to(breath.querySelector('.w-ring'), { scale: 1.34, duration: 0.9, ease: 'sine.inOut' }, 2.7)
        .to(breath.querySelector('.w-ring'), { scale: 1, duration: 0.9, ease: 'sine.inOut' }, 3.6);
      modes.forEach(function (m, i) {
        tl.to(m, { opacity: 1, y: 0, duration: 0.35 }, 4.5 + i * 0.24);
      });
    }
    chain.forEach(function (c, i) {
      tl.to(c, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 2.1 + i * 0.5);
    });

    // 3. The interface. It assembles, and one live control works on top of it.
    var uiAt = centred ? 5.6 : 2.9;
    if (world) tl.to(world, { opacity: 0, duration: 0.5 }, uiAt - 0.55);
    if (!centred) tl.to(copy, { opacity: 0, y: -30, duration: 0.45 }, uiAt - 0.5);
    tl.to(ui, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'power2.out' }, uiAt);

    if (typed && caret) {
      // The search runs itself, one character at a time, tied to scroll.
      var term = 'housing';
      tl.to(typed, { opacity: 1, duration: 0.3 }, uiAt + 0.7);
      tl.to({ i: 0 }, {
        i: term.length, duration: 0.9, ease: 'none',
        onUpdate: function () { caret.textContent = term.slice(0, Math.round(this.targets()[0].i)); }
      }, uiAt + 0.9);
    }
    chips.forEach(function (c, i) {
      tl.to(c, { opacity: 1, y: 0, duration: 0.3 }, uiAt + 0.7 + i * 0.16);
    });
    if (chips.length) tl.call(function () { chips[2].classList.add('is-on'); }, null, uiAt + 1.5);

    // 4. The one thing it is for. The interface steps back so the line lands.
    var closeAt = uiAt + 3.1;
    tl.to(ui, { opacity: 0, y: -34, duration: 0.5 }, closeAt - 0.6)
      .to(close, { opacity: 1, y: 0, duration: 0.5 }, closeAt)
      .to(cta,   { opacity: 1, y: 0, duration: 0.4 }, closeAt + 0.3);

    // 5. Back to a point, so the next product activates out of the same space.
    tl.to([close, cta], { opacity: 0, duration: 0.45 }, closeAt + 1.5)
      .to(dv.querySelector('.dive-sticky'), { scale: 0.86, opacity: 0, duration: 0.6, ease: 'power2.in' }, closeAt + 1.7);
  });

  /* ---------- the EventFinder rotor ----------
     Find your peace, your community, your purpose. One word, swapped in place,
     driven by scroll rather than a timer so it never animates while the reader
     is somewhere else on the page. */
  (function () {
    var rotor = document.getElementById('efRotor');
    var dive = document.getElementById('dive-3');
    if (!rotor || !dive) return;
    var words = ['Peace', 'Community', 'Purpose'];
    var i = 0;
    ScrollTrigger.create({
      trigger: dive, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: function (self) {
        // Three words across the first half of the dive, then it settles.
        var n = Math.min(words.length - 1, Math.floor(self.progress * 6));
        if (n === i) return;
        i = n;
        gsap.fromTo(rotor, { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out',
            onStart: function () { rotor.textContent = words[i]; } });
      }
    });
  })();

  /* ---------- 4. the deck ----------
     Nine cards on a shared perspective plane. Each one starts tilted on its own
     axis and rotates toward flat as the section crosses the viewport, so the
     grid reads as a solid object turning to face the reader rather than as a
     wall of thumbnails.

     The wall moves by row rather than by card: a row shares one tilt and turns
     as a single plane, and neighbouring rows travel sideways in opposite
     directions, which is what gives the whole thing its drift. */
  var deckGrid = document.getElementById('deckGrid');
  if (deckGrid) {
    var cards = [].slice.call(deckGrid.querySelectorAll('.deck-card'));

    /* The stylesheet flattens the pose below 900px, on the grounds that a strong
       3D tilt on a narrow screen reads as a rendering fault rather than depth.
       GSAP writes an inline transform, which outranks that rule, so the same
       restraint has to be repeated here. */
    var poseScale = desktop ? 1 : 0.35;

    /* Rows, not cards. Every card in a row shares one tilt so the row reads as
       a single plane being turned, and the rows travel sideways in alternate
       directions as the reader scrolls, which is what gives the wall its drift.
       Rows are read off the layout rather than assumed from the index, because
       the grid is three across, then two, then one. */
    var rows = [];
    cards.forEach(function (c) {
      var top = Math.round(c.offsetTop);
      var row = rows.filter(function (r) { return Math.abs(r.top - top) < 24; })[0];
      if (!row) { row = { top: top, cards: [] }; rows.push(row); }
      row.cards.push(c);
    });
    rows.sort(function (a, b) { return a.top - b.top; });

    var ROW_POSE = [
      { rx: 13, ry: -13, rz: -2.5 },
      { rx: 10, ry:  13, rz:  2.5 },
      { rx: 13, ry: -11, rz: -2 }
    ];

    rows.forEach(function (row, ri) {
      var pose = ROW_POSE[ri % ROW_POSE.length];
      // Rows one and three go one way, row two the other.
      var dir = (ri % 2 === 0) ? -1 : 1;

      row.cards.forEach(function (card) {
        gsap.set(card, {
          rotateX: pose.rx * poseScale, rotateY: pose.ry * poseScale,
          rotateZ: pose.rz * poseScale, opacity: 0, y: 40
        });

        gsap.to(card, {
          opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 92%', once: true }
        });

        // The turn. One scrub value for the whole row, so a row flattens
        // together instead of the cards in it arriving at different angles.
        gsap.to(card, {
          rotateX: 0, rotateY: 0, rotateZ: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: deckGrid, start: 'top 85%', end: 'bottom 55%', scrub: 0.6
          }
        });

        // The drift.
        gsap.fromTo(card, { xPercent: dir * -7 }, {
          xPercent: dir * 7, ease: 'none',
          scrollTrigger: { trigger: deckGrid, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
      });
    });

    // The whole plane leans back slightly as the section leaves, so the deck
    // hands off to the tour instead of just scrolling away.
    gsap.to(deckGrid, {
      rotateX: -6, y: -30, ease: 'none',
      scrollTrigger: { trigger: deckGrid, start: 'bottom 70%', end: 'bottom 20%', scrub: 0.8 }
    });
  }

  /* ---------- 5. reveals ---------- */
  gsap.utils.toArray('[data-reveal]').forEach(function (el) { gsap.set(el, { y: 34, opacity: 0 }); });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, { y: 0, opacity: 1, duration: 0.85, ease: 'power3.out', stagger: 0.08, overwrite: true });
    }
  });

  /* ---------- 6. keep measurements honest ---------- */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  var t;
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    img.addEventListener('load', function () {
      clearTimeout(t);
      t = setTimeout(function () { ScrollTrigger.refresh(); }, 220);
    });
  });
})();
