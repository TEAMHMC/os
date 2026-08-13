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
  var PERSONA_PATHS = {
    all:       [1, 2, 3, 4, 5, 6, 7, 8, 9],
    member:    [1, 2, 3, 4, 9],
    volunteer: [6, 7, 1, 9],
    partner:   [8, 1, 3, 6],
    funder:    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  };
  var PERSONA_NOTES = {
    all:       '',
    member:    'Showing the tools you can use yourself. The rest follow underneath.',
    volunteer: 'Showing what you will use as a volunteer. The rest follow underneath.',
    partner:   'Showing what your organization works with. The rest follow underneath.',
    funder:    'Showing the full system. Every tool below is running today.'
  };

  var whoBtns = [].slice.call(document.querySelectorAll('.who-btn'));
  var whoNote = document.getElementById('whoNote');
  var seq = document.getElementById('tour');
  var stages = [].slice.call(document.querySelectorAll('article.tool'));

  if (whoBtns.length && stages.length) {
    // Remember where each stage started so "show me everything" can put the
    // tour back exactly as it was rather than approximately.
    stages.forEach(function (el, i) { el.style.order = String(i); });

    function applyPersona(key, announce) {
      var path = PERSONA_PATHS[key] || PERSONA_PATHS.all;
      var inPath = {};
      path.forEach(function (n, i) { inPath[n] = i; });

      stages.forEach(function (el) {
        var n = parseInt(el.getAttribute('data-tool'), 10);
        var lines = {};
        try { lines = JSON.parse(el.getAttribute('data-lines') || '{}'); } catch (e) {}
        var line = el.querySelector('.line');

        if (line) {
          if (!line.getAttribute('data-default')) line.setAttribute('data-default', line.textContent);
          line.textContent = (key !== 'all' && lines[key]) ? lines[key] : line.getAttribute('data-default');
        }

        var idx = el.querySelector('.idx span');
        if (idx) {
          if (!idx.getAttribute('data-default')) idx.setAttribute('data-default', idx.textContent);
          if (key === 'all' || key === 'funder' || !(n in inPath)) {
            idx.textContent = idx.getAttribute('data-default');
          } else {
            var pos = inPath[n] + 1;
            idx.textContent = ('0' + pos).slice(-2) + ' / ' + ('0' + path.length).slice(-2);
          }
        }

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

  /* ---------- 2. the four opening lines ----------
     Four short statements, one at a time, held on a pinned black screen.
     Scroll is the cut between them. This is the only place on the page where
     motion replaces layout, and it is doing the job a voiceover would. */
  if (desktop) {
    var beats = gsap.utils.toArray('.beat');
    if (beats.length) {
      gsap.set(beats, { opacity: 0, y: 26 });
      gsap.set(beats[0], { opacity: 1, y: 0 });
      // The sticky hold is CSS. ScrollTrigger only reads progress across it,
      // so there is no second pinning mechanism fighting the first.
      var tlBeats = gsap.timeline({
        scrollTrigger: { trigger: '.premise', start: 'top top', end: 'bottom bottom', scrub: 0.6 }
      });
      beats.forEach(function (b, i) {
        if (i === 0) return;
        tlBeats.to(beats[i - 1], { opacity: 0, y: -26, duration: 0.4 }, i - 1)
               .fromTo(b, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5 }, i - 0.75);
      });
      tlBeats.to({}, { duration: 0.6 });
    }
  } else {
    gsap.set('.beat', { clearProps: 'all' });
  }

  /* ---------- 3. the nine tools ----------
     Each tool holds the viewport for one screen of scrolling. Its interface
     settles into place, the copy follows a beat later, and both leave as the
     next tool arrives. That arrival and departure is what makes the section
     read as a sequence instead of a list. */
  var railItems = document.querySelectorAll('[data-rail]');
  var hud = document.getElementById('hud');
  var hudIdx = document.getElementById('hudIdx');
  var hudName = document.getElementById('hudName');

  gsap.utils.toArray('.tool').forEach(function (tool) {
    var media = tool.querySelector('.stage-media');
    var copy = tool.querySelector('.tool-copy');
    var index = tool.getAttribute('data-tool');

    if (desktop) {
      // Arrive. Finishes before the stage locks, so the settled state is what
      // the reader spends most of the section looking at.
      gsap.timeline({
        scrollTrigger: { trigger: tool, start: 'top 95%', end: 'top 45%', scrub: 0.45 }
      })
        .fromTo(media, { y: 80, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, ease: 'power2.out' }, 0)
        .fromTo(copy, { y: 44, opacity: 0 }, { y: 0, opacity: 1, ease: 'power2.out' }, 0.1);

      // Hand off. The stage releases upward just before it unsticks, so one
      // tool is always giving the screen to the next rather than cutting.
      gsap.timeline({
        scrollTrigger: { trigger: tool, start: 'bottom 118%', end: 'bottom bottom', scrub: 0.45 }
      })
        .to([media, copy], { y: -55, opacity: 0, ease: 'power1.in' }, 0);

      // Depth. A stage holds the screen for eighty viewport pixels of scroll in
      // which the arrival has finished and the exit has not started, and until
      // now nothing moved in it. The device drifts against the copy across the
      // whole stage, so the two columns read as two planes rather than one flat
      // card. It runs on the frame inside .stage-media, never on .stage-media
      // itself, because the arrival and the hand off already own that element's
      // y and a second tween on the same property would fight them.
      var device = tool.querySelector('.frame, .phone');
      if (device) {
        gsap.fromTo(device, { y: 30 }, {
          y: -30, ease: 'none',
          scrollTrigger: { trigger: tool, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
        });
      }

      // The same idea one layer deeper: the screenshot slides behind the browser
      // chrome the way a view moves behind a window frame. .frame already clips,
      // so the only thing to get right is that the image still covers the
      // opening at both ends of the travel. The shot is 50vh tall within a
      // clamp that floors at 250px, and a scale of 1.1 buys 12.5px of overhang
      // at that floor, which is the 10px of travel with room to spare. Widen
      // the travel and the frame shows a white sliver at the turn.
      var shot = tool.querySelector('.frame-shot');
      if (shot) {
        gsap.fromTo(shot, { y: -10, scale: 1.1 }, {
          y: 10, scale: 1.1, ease: 'none',
          scrollTrigger: { trigger: tool, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
        });
      }

      ScrollTrigger.create({
        trigger: tool, start: 'top 60%', end: 'bottom 40%',
        onToggle: function (self) {
          if (!self.isActive) return;
          railItems.forEach(function (li) {
            li.classList.toggle('is-active', li.getAttribute('data-rail') === index);
          });
          if (hudIdx) hudIdx.textContent = ('0' + index).slice(-2);
          if (hudName) hudName.textContent = tool.getAttribute('data-name') || '';
        }
      });
    } else {
      gsap.fromTo([media, copy], { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out', stagger: 0.08,
          scrollTrigger: { trigger: tool, start: 'top 82%', once: true } });
    }
  });

  // The position marker only exists while the sequence does.
  if (hud && desktop) {
    ScrollTrigger.create({
      trigger: '.seq', start: 'top 20%', end: 'bottom 80%',
      onToggle: function (self) { hud.classList.toggle('is-on', self.isActive); }
    });
  }

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
