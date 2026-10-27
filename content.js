(() => {
  "use strict";

  const TAG = "[LanguageFlags]";
  const BOX_ID = "lsf-flag-box";

  // Flags available in the flags/ folder
  const FLAGS = new Set(
    ("ae at be bg br ca ch cn cz de dk ee es fi fr gb gr hr hu id ie il in it jp kr lt lv mx my nl no pl pt ro rs ru sa se si sk th tr tw ua us vn").split(" ")
  );

  // Language -> flag, used when the locale has no region or the region has no flag in the folder
  const LANG_TO_COUNTRY = {
    en: "gb", de: "de", fr: "fr", es: "es", it: "it", pt: "pt", nl: "nl", pl: "pl",
    cs: "cz", sk: "sk", hu: "hu", ro: "ro", bg: "bg", el: "gr", tr: "tr", ru: "ru",
    uk: "ua", sv: "se", nb: "no", no: "no", da: "dk", fi: "fi", lt: "lt", lv: "lv",
    et: "ee", hr: "hr", sl: "si", sr: "rs", he: "il", ar: "sa", hi: "in", ja: "jp",
    ko: "kr", zh: "cn", id: "id", ms: "my", th: "th", vi: "vn"
  };

  const LOCALE_RE = /^[a-z]{2,3}_[A-Z]{2}$/;
  const FIELD_RE = /name|description|tagline/i;

  let currentSlug = null;
  let lastLocales = null;
  let running = false;

  function getSlug() {
    const m = location.pathname.match(/^\/(?:company|school)\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getCsrf() {
    const m = document.cookie.match(/JSESSIONID="?([^";]+)"?/);
    return m ? m[1] : null;
  }

  // Collects locales from all "localized" maps that belong to name, description or tagline
  // and contain non-empty text.
  function collectLocales(node, path, found, texts) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((n) => collectLocales(n, path, found, texts));
      return;
    }
    for (const [key, val] of Object.entries(node)) {
      if (key === "localized" && val && typeof val === "object" && !Array.isArray(val)) {
        if (FIELD_RE.test(path)) {
          const field = /tagline/i.test(path) ? "tagline" : /descr/i.test(path) ? "description" : "name";
          for (const [loc, text] of Object.entries(val)) {
            if (LOCALE_RE.test(loc) && typeof text === "string" && text.trim()) {
              (found[loc] = found[loc] || new Set()).add(path);
              (texts[loc] = texts[loc] || {})[field] = text;
            }
          }
        }
      } else if (val && typeof val === "object") {
        collectLocales(val, key, found, texts);
      }
    }
  }

  // Finds the company's primary language ("defaultLocale", e.g. {language: "en", country: "US"}) as "en_US"
  function findPrimary(node) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const n of node) { const r = findPrimary(n); if (r) return r; }
      return null;
    }
    const d = node.defaultLocale;
    if (d && typeof d === "object" && d.language) return d.language + "_" + (d.country || d.language.toUpperCase());
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") { const r = findPrimary(v); if (r) return r; }
    }
    return null;
  }

  async function fetchLocales(slug) {
    const csrf = getCsrf();
    if (!csrf) {
      console.warn(TAG, "No JSESSIONID cookie found, are you logged in?");
      return null;
    }
    const base = "/voyager/api/organization/companies?q=universalName&universalName=" + encodeURIComponent(slug);
    // Without decorationId the response includes name, tagline and description in all languages
    const urls = [
      base,
      base + "&decorationId=com.linkedin.voyager.deco.organization.web.WebFullCompanyMain-12"
    ];
    const allFound = {};
    const allTexts = {};
    let primary = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          credentials: "include",
          signal: AbortSignal.timeout(10000), // never hang forever, otherwise update() would stay blocked
          headers: {
            "csrf-token": csrf,
            "accept": "application/vnd.linkedin.normalized+json+2.1",
            "x-restli-protocol-version": "2.0.0"
          }
        });
        if (!res.ok) {
          console.warn(TAG, "API response", res.status, url);
          continue;
        }
        const json = await res.json();
        collectLocales(json, "", allFound, allTexts);
        primary = primary || findPrimary(json);
        const locales = Object.keys(allFound).sort();
        console.log(TAG, slug, "locales found:", locales, allFound);
        // Done once the description is present too (the decorated variant does not always include it)
        if (locales.length && locales.some((l) => allTexts[l] && allTexts[l].description)) {
          locales.texts = allTexts;
          locales.primary = primary;
          return locales;
        }
      } catch (e) {
        console.warn(TAG, "Request failed", e);
      }
    }
    const merged = Object.keys(allFound).sort();
    if (!merged.length && primary) merged.push(primary); // no localized texts at all: still show the primary language
    merged.texts = allTexts;
    merged.primary = primary;
    return merged;
  }

  function flagFor(locale) {
    const [lang, region] = locale.split("_");
    const r = region.toLowerCase();
    if (FLAGS.has(r)) return r;
    return LANG_TO_COUNTRY[lang] || null;
  }

  // Finds the "Overview" heading ("Übersicht" in German) above the description text
  function findOverviewHeading() {
    const re = /^(übersicht|overview)$/i;
    return [...document.querySelectorAll("main h1, main h2, main h3")].find((h) =>
      re.test(h.textContent.replace(/\s+/g, " ").trim())
    ) || null;
  }

  const MAX_INLINE = 10; // more flags than this go on their own line below the heading
  const POP_ID = "lsf-popover";
  let popLoc = null;

  function primaryOf(el) { return el && el.dataset ? el.dataset.primaryLoc : null; }

  function closePopover() {
    document.getElementById(POP_ID)?.remove();
    popLoc = null;
  }

  // Shows name, tagline and description of the chosen language in a popover below the flag
  function togglePopover(loc, anchor, texts) {
    const wasOpen = popLoc === loc;
    closePopover();
    if (wasOpen) return;
    const t = (texts && texts[loc]) || {};
    const pop = document.createElement("div");
    pop.id = POP_ID;
    Object.assign(pop.style, {
      position: "fixed", zIndex: "2147483647",
      maxHeight: "60vh", overflowY: "auto", boxSizing: "border-box",
      background: "#fff", color: "#000", border: "1px solid rgba(0,0,0,.2)", borderRadius: "8px",
      boxShadow: "0 6px 24px rgba(0,0,0,.25)", padding: "14px 16px", font: "14px/1.45 sans-serif"
    });
    // Width is capped to the viewport; horizontal position is clamped so the popover never crosses the left or right edge
    const margin = 12;
    const width = Math.min(480, document.documentElement.clientWidth - 2 * margin);
    pop.style.width = width + "px";
    const rect = anchor.getBoundingClientRect();
    pop.style.top = Math.round(rect.bottom + 8) + "px";
    const maxLeft = document.documentElement.clientWidth - width - margin;
    pop.style.left = Math.round(Math.min(Math.max(rect.right - width, margin), maxLeft)) + "px";

    const add = (text, style) => {
      if (!text) return;
      const p = document.createElement("div");
      p.textContent = text;
      Object.assign(p.style, { marginBottom: "10px", whiteSpace: "pre-wrap" }, style);
      pop.appendChild(p);
    };
    add(loc + (loc === primaryOf(anchor) ? " (primary language)" : ""), { font: "600 12px sans-serif", color: "#666" });
    add(t.name, { font: "600 16px/1.3 sans-serif" });
    add(t.tagline, { color: "#333" });
    add(t.description, { marginBottom: "0" });
    if (!t.name && !t.tagline && !t.description) add("No texts found for this language.");
    pop.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(pop);
    popLoc = loc;
  }

  document.addEventListener("click", closePopover);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopover(); });
  window.addEventListener("scroll", closePopover, { passive: true });

  function render(locales) {
    closePopover();
    document.getElementById(BOX_ID)?.remove();
    if (!locales || locales.length < 1) return;
    const heading = findOverviewHeading();
    // Flags only appear next to the "Overview" heading (Home and About tabs)
    if (!heading) return;
    const box = document.createElement("div");
    box.id = BOX_ID;
    Object.assign(box.style, {
      display: heading ? "inline-flex" : "flex", alignItems: "center", gap: "8px",
      marginLeft: "16px", flexWrap: "nowrap", flexShrink: "0", verticalAlign: "middle"
    });
    // Primary language first, the rest alphabetical
    const ordered = [...locales].sort((a, b) => (b === locales.primary) - (a === locales.primary));
    for (const loc of ordered) {
      const isPrimary = loc === locales.primary;
      const code = flagFor(loc);
      if (code) {
        const img = document.createElement("img");
        img.src = chrome.runtime.getURL("flags/" + code + ".svg");
        img.alt = loc;
        img.title = isPrimary ? loc + " (primary language)" : loc;
        if (isPrimary) img.dataset.primaryLoc = loc;
        Object.assign(img.style, {
          width: "32px", height: "24px", borderRadius: "3px",
          boxShadow: isPrimary ? "0 0 0 2px #fff, 0 0 0 4px #0a66c2" : "0 0 0 1px rgba(0,0,0,.15)",
          objectFit: "cover", margin: isPrimary ? "0 4px" : "0"
        });
        img.style.cursor = "pointer";
        img.addEventListener("click", (e) => { e.stopPropagation(); togglePopover(loc, img, locales.texts); });
        box.appendChild(img);
      } else {
        const s = document.createElement("span");
        s.textContent = loc;
        s.title = isPrimary ? loc + " (primary language)" : loc;
        if (isPrimary) s.dataset.primaryLoc = loc;
        Object.assign(s.style, {
          font: "600 12px sans-serif", padding: "4px 6px",
          border: isPrimary ? "2px solid #0a66c2" : "1px solid #999", borderRadius: "3px"
        });
        s.style.cursor = "pointer";
        s.addEventListener("click", (e) => { e.stopPropagation(); togglePopover(loc, s, locales.texts); });
        box.appendChild(s);
      }
    }
    if (heading && ordered.length > MAX_INLINE) {
      // Many languages: put the flags on their own line below the heading, right-aligned and wrapping
      Object.assign(box.style, {
        display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "8px",
        margin: "8px 0 0 auto", width: "fit-content", boxSizing: "border-box",
        // 10 flags per row: 10 x 32px + 9 x 8px gaps + 8px extra margin around the highlighted primary flag
        maxWidth: "min(" + (MAX_INLINE * 32 + (MAX_INLINE - 1) * 8 + 8) + "px, 100%)"
      });
      heading.insertAdjacentElement("afterend", box);
      return;
    }
    if (heading) {
      // Right-aligned and vertically centered on the "Overview" heading.
      // Absolutely positioned so it always lands in the heading row, whatever the layout (flex, block, column).
      const parent = heading.parentElement;
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      const padRight = parseFloat(getComputedStyle(parent).paddingRight) || 0;
      Object.assign(box.style, {
        position: "absolute", display: "inline-flex", margin: "0", right: padRight + "px"
      });
      parent.appendChild(box);
      const boxH = box.offsetHeight || 24;
      box.style.top = Math.round(heading.offsetTop + Math.max(0, (heading.offsetHeight - boxH) / 2)) + "px";
      return;
    }
    // No "Overview" heading: this is a tab without it (Posts, Jobs, People) or the page is still loading.
    // Show nothing; update() tries again on the next tick.
  }

  async function update() {
    if (running) return;
    const slug = getSlug();
    if (!slug) return;
    const existing = document.getElementById(BOX_ID);
    const h = findOverviewHeading();
    // Render again if the box is missing or still in the fallback position although the heading now exists
    const needsRender = !existing || (h && existing.parentElement !== h.parentElement);
    if (slug === currentSlug && !(needsRender && lastLocales && lastLocales.length > 0)) return;
    running = true;
    try {
      if (slug !== currentSlug) {
        currentSlug = slug;
        document.getElementById(BOX_ID)?.remove();
        lastLocales = await fetchLocales(slug);
        // The user may have moved to another page while the request was running: start over for that page
        if (getSlug() !== slug) {
          currentSlug = null;
          return;
        }
      }
      render(lastLocales);
    } finally {
      running = false;
    }
  }

  // LinkedIn is a single-page app: keep checking URL and DOM
  setInterval(update, 1500);
  update();
})();
