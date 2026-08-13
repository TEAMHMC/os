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
     The product name arrives first and by itself, then the sentence that
     explains it, then the way in. That order is the whole point of the hero. */
  (function hero() {
    var mark = document.getElementById('heroMark');
    if (!mark) return;
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(mark, { yPercent: 18, opacity: 0, scale: 1.04, duration: 1.1 })
      .from('.hero .eyebrow', { y: 14, opacity: 0, duration: 0.6 }, 0.15)
      .from('.hero-sub', { y: 24, opacity: 0, duration: 0.8 }, '-=0.55')
      .from('.hero-lede', { y: 20, opacity: 0, duration: 0.8 }, '-=0.6')
      .from('.hero-cta .hmc-btn', { y: 16, opacity: 0, duration: 0.6, stagger: 0.09 }, '-=0.55')
      .from('.scroll-cue', { opacity: 0, duration: 0.6 }, '-=0.3');

    // The hero lifts away rather than cutting, so the first pinned section
    // feels like the same shot continuing.
    gsap.to('.hero-inner', {
      y: -70, opacity: 0.15, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 25%', scrub: true }
    });
    gsap.to('.scroll-cue', {
      opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '30% top', scrub: true }
    });

    // Depth on the way out. The copy lifts, and behind it the grid and the glow
    // fall at two slower rates, which is the whole of what parallax is: things
    // further away moving less. The glow carries its own translate(-50%,-50%)
    // for centring and GSAP keeps that as xPercent and yPercent, so the y here
    // is added to it rather than replacing it.
    gsap.to('.hero-grid', {
      y: 90, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.to('.hero-glow', {
      y: 150, opacity: 0.4, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
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

    // 1. Arrival. Coming up from small is the camera closing the distance.
    tl.to(copy, { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.1);

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
    if (quiet)  tl.to(quiet,  { opacity: 1, y: 0, duration: 0.6 }, 0.8);
    if (breath) {
      // One complete breath, held long enough to actually follow.
      tl.to(breath, { opacity: 1, scale: 1, duration: 0.7 }, 0.7)
        .to(breath.querySelector('.w-ring'), { scale: 1.34, duration: 0.9, ease: 'sine.inOut' }, 1.4)
        .to(breath.querySelector('.w-ring'), { scale: 1, duration: 0.9, ease: 'sine.inOut' }, 2.3);
      modes.forEach(function (m, i) {
        tl.to(m, { opacity: 1, y: 0, duration: 0.35 }, 3.2 + i * 0.28);
      });
    }
    chain.forEach(function (c, i) {
      tl.to(c, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.9 + i * 0.5);
    });

    // 3. The interface. It assembles, and one live control works on top of it.
    tl.to(ui, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 2.6);
    if (world) tl.to(world, { opacity: 0.18, duration: 0.6 }, 2.6);

    if (typed && caret) {
      // The search runs itself, one character at a time, tied to scroll.
      var term = 'housing';
      tl.to(typed, { opacity: 1, duration: 0.3 }, 3.3);
      tl.to({ i: 0 }, {
        i: term.length, duration: 0.9, ease: 'none',
        onUpdate: function () { caret.textContent = term.slice(0, Math.round(this.targets()[0].i)); }
      }, 3.5);
    }
    chips.forEach(function (c, i) {
      tl.to(c, { opacity: 1, y: 0, duration: 0.3 }, 3.3 + i * 0.16);
    });
    if (chips.length) tl.call(function () { chips[2].classList.add('is-on'); }, null, 4.1);

    // 4. The one thing it is for. The interface steps back so the line lands.
    tl.to([copy, ui], { opacity: 0, y: -34, duration: 0.5 }, 4.6)
      .to(close, { opacity: 1, y: 0, duration: 0.5 }, 4.9)
      .to(cta,   { opacity: 1, y: 0, duration: 0.4 }, 5.2);

    // 5. Back to a point, so the next product activates out of the same space.
    tl.to([close, cta], { opacity: 0, duration: 0.4 }, 6.1)
      .to(dv.querySelector('.dive-sticky'), { scale: 0.86, opacity: 0, duration: 0.6, ease: 'power2.in' }, 6.2);
    if (world) tl.to(world, { opacity: 0, duration: 0.4 }, 6.1);
  });

  /* ---------- 4. the loop ----------
     Five steps that hand a single person from one tool to the next. They move
     sideways because the point is the handoff, and sideways is what a handoff
     looks like. Vertical stacking loses that on desktop; on phones the CSS
     stacks them and this never runs. */
  if (desktop) {
    var track = document.getElementById('track');
    if (track) {
      // CSS sticky holds the panel; this only converts scroll progress into
      // sideways distance across the five steps.
      ScrollTrigger.create({
        trigger: '.loop', start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: function (self) {
          var distance = track.scrollWidth - window.innerWidth + 40;
          if (distance < 0) distance = 0;
          gsap.set(track, { x: -distance * self.progress });
        }
      });

      // The heading rises a little while the steps travel sideways. Two
      // directions at once is what stops the pinned panel from reading as a
      // still image with a slider bolted onto it. Small on purpose: the heading
      // has to stay readable for the length of the whole track.
      gsap.to('.loop-head', {
        y: -42, ease: 'none',
        scrollTrigger: { trigger: '.loop', start: 'top top', end: 'bottom bottom', scrub: true }
      });
    }
  }

  /* ---------- 5. numbers ----------
     A number that counts up is read. A number that is simply printed is
     skimmed. Only used on the four figures that carry the argument. */
  document.querySelectorAll('.count').forEach(function (el) {
    var end = parseFloat(el.getAttribute('data-count'));
    if (isNaN(end)) return;
    var suffix = el.getAttribute('data-suffix') || '';
    var comma = el.getAttribute('data-format') === 'comma';
    var obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: end, duration: 1.5, ease: 'power2.out',
          onUpdate: function () {
            var n = Math.round(obj.v);
            el.textContent = (comma ? n.toLocaleString('en-US') : String(n)) + suffix;
          }
        });
      }
    });
  });

  /* ---------- the deck ----------
     Nine cards on a shared perspective plane. Each one starts tilted on its own
     axis and rotates toward flat as the section crosses the viewport, so the
     grid reads as a solid object turning to face the reader rather than as a
     wall of thumbnails.

     Per-card variation is what stops it looking mechanical: the seed below gives
     every card a slightly different starting angle and a slightly different rate,
     so the deck settles the way a hand-arranged set of objects would. */
  var deckGrid = document.getElementById('deckGrid');
  if (deckGrid) {
    var cards = [].slice.call(deckGrid.querySelectorAll('.deck-card'));

    // Fixed, not random: a reload should not reshuffle the composition.
    var POSE = [
      { rx: 16, ry: -18, rz: -3, z: -60 },
      { rx: 13, ry:   0, rz:  2, z: -20 },
      { rx: 16, ry:  18, rz:  3, z: -60 },
      { rx: 10, ry: -14, rz:  2, z: -30 },
      { rx:  8, ry:   0, rz: -1, z:   0 },
      { rx: 10, ry:  14, rz: -2, z: -30 },
      { rx: 15, ry: -17, rz:  3, z: -55 },
      { rx: 12, ry:   0, rz: -2, z: -15 },
      { rx: 15, ry:  17, rz: -3, z: -55 }
    ];

    /* The stylesheet flattens the resting pose below 900px, on the grounds that
       a strong 3D tilt on a narrow screen reads as a rendering fault rather than
       as depth. GSAP writes an inline transform, which outranks that rule, so
       the same restraint has to be repeated here. Without it a phone got the
       full desktop tilt and the top card leaned far enough to sit on its own
       label. */
    var poseScale = desktop ? 1 : 0.35;

    cards.forEach(function (card, i) {
      var pose = POSE[i % POSE.length];
      gsap.set(card, {
        rotateX: pose.rx * poseScale,
        rotateY: pose.ry * poseScale,
        rotateZ: pose.rz * poseScale,
        z: pose.z * poseScale, opacity: 0, y: 40
      });

      // Arrival. The card lifts into its tilted pose, which reads as the object
      // being set down rather than as a fade.
      gsap.to(card, {
        opacity: 1, y: 0,
        duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 92%', once: true }
      });

      // The turn. Scrub means the reader drives it; the deck is never animating
      // on its own while somebody is reading.
      gsap.to(card, {
        rotateX: 0, rotateY: 0, rotateZ: 0, z: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: deckGrid,
          start: 'top 85%',
          end: 'bottom 55%',
          scrub: 0.6 + (i % 3) * 0.18
        }
      });
    });

    // The whole plane leans back slightly as the section leaves, so the deck
    // hands off to the tour instead of just scrolling away.
    gsap.to(deckGrid, {
      rotateX: -6, y: -30, ease: 'none',
      scrollTrigger: { trigger: deckGrid, start: 'bottom 70%', end: 'bottom 20%', scrub: 0.8 }
    });
  }

  /* ---------- 6. reveals ---------- */
  gsap.utils.toArray('[data-reveal]').forEach(function (el) { gsap.set(el, { y: 34, opacity: 0 }); });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, { y: 0, opacity: 1, duration: 0.85, ease: 'power3.out', stagger: 0.08, overwrite: true });
    }
  });

  /* ---------- 7. keep measurements honest ---------- */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  var t;
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    img.addEventListener('load', function () {
      clearTimeout(t);
      t = setTimeout(function () { ScrollTrigger.refresh(); }, 220);
    });
  });
})();
