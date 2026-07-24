(() => {
  "use strict";

  const root = document.querySelector(".community");
  if (!root) return;

  const apiUrl = root.dataset.api;
  const nf = new Intl.NumberFormat("tr-TR");

  const els = {
    icon: document.getElementById("c-icon"),
    banner: document.getElementById("c-banner"),
    lqip: document.getElementById("c-banner-lqip"),
    real: document.getElementById("c-banner-real"),
    name: document.getElementById("c-name"),
    desc: document.getElementById("c-desc"),
    stats: document.getElementById("c-stats"),
    subs: document.getElementById("stat-subs"),
    posts: document.getElementById("stat-posts"),
    active: document.getElementById("stat-active"),
  };

  const copyBtn = document.getElementById("btn-copy");
  if (copyBtn) {
    const original = copyBtn.textContent;
    copyBtn.addEventListener("click", async () => {
      const text = copyBtn.dataset.copy || "";
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        copyBtn.textContent = "Kopyalandı ✓";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.classList.remove("copied");
        }, 1800);
      } catch {
        copyBtn.textContent = "Kopyalanamadı";
        setTimeout(() => (copyBtn.textContent = original), 1800);
      }
    });
  }

  function safeImageUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
    } catch {
      return null;
    }
  }

  function optimize(url) {
    if (url.includes("/pictrs/image/") && !/\.webp($|\?)/i.test(url) && !/[?&]format=/.test(url)) {
      return url + (url.includes("?") ? "&" : "?") + "format=webp";
    }
    return url;
  }

  function paintIcon(el, url) {
    const safe = safeImageUrl(optimize(url));
    if (!el || !safe) return;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url(${JSON.stringify(safe)})`;
      el.classList.add("loaded");
    };
    img.src = safe;
  }

  let currentBanner = null;
  function paintBanner(iconUrl, bannerUrl, instant) {
    if (!els.banner || !els.real) return;
    els.banner.hidden = false;

    const ph = iconUrl && safeImageUrl(optimize(iconUrl));
    if (ph && els.lqip) els.lqip.style.backgroundImage = `url(${JSON.stringify(ph)})`;

    const safe = safeImageUrl(optimize(bannerUrl));
    if (!safe || safe === currentBanner) return;
    currentBanner = safe;

    if (instant) {
      els.real.classList.add("no-fade");
      els.real.style.backgroundImage = `url(${JSON.stringify(safe)})`;
      els.real.classList.add("loaded");
      return;
    }
    const img = new Image();
    img.onload = () => {
      els.real.style.backgroundImage = `url(${JSON.stringify(safe)})`;
      els.real.classList.add("loaded");
    };
    img.src = safe;
  }

  function render(view, instant) {
    if (view.icon) paintIcon(els.icon, view.icon);
    if (view.banner) paintBanner(view.icon, view.banner, instant);

    if (
      typeof view.subscribers === "number" ||
      typeof view.posts === "number" ||
      typeof view.activeWeek === "number"
    ) {
      if (els.subs && typeof view.subscribers === "number") els.subs.textContent = nf.format(view.subscribers);
      if (els.posts && typeof view.posts === "number") els.posts.textContent = nf.format(view.posts);
      if (els.active && typeof view.activeWeek === "number") els.active.textContent = nf.format(view.activeWeek);
      if (els.stats) els.stats.hidden = false;
    }
  }

  const CACHE_TTL = 60 * 60 * 1000;
  const cacheKey = `lemmyc:${apiUrl}`;

  function readCache() {
    try {
      const obj = JSON.parse(localStorage.getItem(cacheKey));
      if (obj && Date.now() - obj.t < CACHE_TTL) return obj.v;
    } catch {}
    return null;
  }
  function writeCache(view) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: view }));
    } catch {}
  }

  function toView(data) {
    const view = data?.community_view;
    if (!view) return null;
    const c = view.community || {};
    const n = view.counts || {};
    return {
      icon: c.icon || null,
      banner: c.banner || null,
      subscribers: typeof n.subscribers === "number" ? n.subscribers : null,
      posts: typeof n.posts === "number" ? n.posts : null,
      activeWeek: typeof n.users_active_week === "number" ? n.users_active_week : null,
    };
  }

  async function fetchView() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(apiUrl, { signal: controller.signal });
      if (!res.ok) return null;
      return toView(await res.json());
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!apiUrl) return;
  const cached = readCache();
  if (cached) render(cached, true);

  fetchView().then((fresh) => {
    if (!fresh) return;
    writeCache(fresh);
    render(fresh, Boolean(cached));
  });
})();
