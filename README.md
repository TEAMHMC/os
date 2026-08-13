# HMC OS

The guided unveiling of HMC OS, the operating system Health Matters Clinic runs on.
One page, nine tools, built as a standalone site so the animation is under our
control rather than a page builder's.

Live at `os.healthmatters.clinic`.

## What is here

```
index.html            the whole page
assets/css/os.css     page styles
assets/css/hmc-parallax.css   shared HMC layer (text mask, reveal helpers)
assets/site/hmc-buttons-1.0.4.css|js   shared HMC button system (pill + 6px dot)
assets/js/os.js       the motion layer
assets/js/vendor/     GSAP, ScrollTrigger, Lenis (vendored, no CDN)
screens/              screenshots captured from the live tools
CNAME                 os.healthmatters.clinic
.github/workflows/deploy.yml   GitHub Pages deploy on push to main
```

## To put it live

1. Create a GitHub repo under TEAMHMC named `os`.
2. `git remote add origin git@github.com:TEAMHMC/os.git` then push `main`.
3. Repo settings, Pages, set Source to GitHub Actions.
4. Cloudflare DNS, add a CNAME record `os` pointing at `teamhmc.github.io`, proxy off.
5. Repo settings, Pages, custom domain `os.healthmatters.clinic`, then enforce HTTPS.

## Notes for whoever edits this next

- No `scroll-behavior: smooth` anywhere. ScrollTrigger jumps the scroller to zero
  while it measures, and a smooth scroller turns that jump into an animation, so
  every measurement comes back offset by however far down the page the reader is.
  Anchor easing is done per click in `os.js` instead.
- Nothing is hidden by CSS alone. `os.js` adds `.motion` to `<html>` only when
  GSAP loaded and the visitor has not asked for reduced motion, so a broken
  script leaves a readable page instead of a blank one.
- `prefers-reduced-motion` gets a full flattened layout, not just paused
  animation. The four opening lines, the nine stages and the five loop steps sit
  on top of each other by design and only motion separates them.
- Screens in `screens/` were captured with headless Chrome at 1280x900 (phones at
  430x932). Recapture them when a tool's interface changes.
- Trademark rule. Symbol on HMC OS, HMC VMS, Event Finder, Check Yourself,
  Your CalmKit, Sunny and Unstoppable. No symbol on Resource Directory, Partner
  Portal, Member Hub or HMC Academy. All marks are pending, so the trademark
  symbol only, never the registered symbol.
- Never state a count of resources, listings or organizations anywhere on this
  page. Those numbers are not accurate.
- Never link a tool to a login screen. Every outbound link here lands on
  something a stranger can use or watch.
- The shared pill (`hmc-buttons-1.0.4.css`) sets `transition-duration` with no
  `transition-property`, so it transitions everything, opacity and transform
  included. GSAP and a CSS transition on the same property fight: GSAP writes
  the from state, CSS eases the live value toward it, and the value GSAP records
  as the destination is whatever the transition had already reached. That is how
  both hero buttons ended up invisible on the live page. `os.css` narrows
  `.hmc-btn` to the colour properties. Do not widen it back, and do not fix this
  in the shared file, which other HMC surfaces load.
- Three doors close the page, in the order the premise sets up: the person
  asking for help, the partner, the funder. The person goes first.
- `assets/js/hmc-parallax.js` and `assets/js/hmc-immersive.js` are the shared
  HMC motion layer and this page does not load either of them. It loads
  `hmc-parallax.css` only, for `.hmc-mask` on the hero mark. Do not add the
  scripts. They run their own scroll loop against `data-layer`, `data-kinetic`
  and `.hmc-pin-wrap` hooks that this page has none of, and a second scroll
  engine alongside ScrollTrigger is what cost a month of debugging on the
  Unstoppable site. The parallax here is section 4 of `os.js`.
- Parallax on this page is three planes in the hero, a device drifting against
  its copy on each of the nine stages with the screenshot drifting again inside
  its frame, and the loop heading rising while the steps travel sideways. Each
  one runs on an element no other tween owns. Two tweens on the same `y` fight,
  and the one that renders last wins, which is not always the one you wrote.
