/* HMC OS analytics.
   What it records, and nothing else
   - which tool a visitor opens from OS (tool_open, with the tool name)
   - clicks to give (give_click) and other outbound links (outbound_click, address without query string)
   - which sections a visitor actually reaches (section_view, once per section)
   It never reads form fields, and OS has none. Query strings are stripped from every recorded address.
   Google only stores anything for people who accepted cookies, through the shared hmc_consent cookie. */
(function () {
  var TOOLS = {
    eventfinder: "EventFinder", calmkit: "Your CalmKit", checkyourself: "CheckYourself",
    directory: "Resource Directory", hub: "Member Hub", unstoppable: "Unstoppable",
    takeactionla: "Take Action LA", volunteer: "Volunteer Portal", partner: "Partner Portal",
    smo: "Street Medicine", mho: "Mobile Health Outreach", youth: "Youth", education: "Education", relief: "Relief"
  };
  function send(name, params) { try { if (typeof gtag === "function") gtag("event", name, params); } catch (e) {} }
  function where(el) { var s = el.closest && el.closest("section[id]"); return s ? s.id : ""; }
  function label(a) { return (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60); }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u;
    try { u = new URL(a.getAttribute("href"), location.href); } catch (x) { return; }
    if (u.protocol === "tel:") { send("phone_click", { location: where(a) }); return; }
    if (u.protocol === "mailto:") { send("email_click", { location: where(a) }); return; }
    if (u.host === location.host) {
      if (a.classList.contains("deck-card")) {
        var n = a.querySelector(".deck-name");
        send("deck_card_click", { name: n ? n.textContent.trim() : "" });
      }
      return;
    }
    var h = u.hostname, sub = h.split(".")[0];
    if (/(^|\.)healthmatters\.clinic$/.test(h)) {
      if (h === "www.healthmatters.clinic" && /^\/donate/.test(u.pathname)) { send("give_click", { location: where(a), link_text: label(a) }); return; }
      if (TOOLS[sub]) { send("tool_open", { tool: TOOLS[sub], location: where(a), link_text: label(a) }); return; }
    }
    send("outbound_click", { link_domain: h, link_url: u.origin + u.pathname, location: where(a) });
  }, true);

  if ("IntersectionObserver" in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        if (seen[id]) return;
        seen[id] = 1;
        var t = en.target.querySelector(".dive-name,h1,h2");
        send("section_view", { section: id, name: t ? t.textContent.trim().slice(0, 40) : "" });
        io.unobserve(en.target);
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 }); /* counts a section when it crosses the middle of the screen, which also works for tall, scroll-pinned sections */
    [].forEach.call(document.querySelectorAll("section[id]"), function (s) { io.observe(s); });
  }
})();
