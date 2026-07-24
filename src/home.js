(() => {
  "use strict";

  const list = document.getElementById("list");
  if (!list) return;

  const cards = Array.from(list.querySelectorAll(".item"));
  const searchInput = document.getElementById("search");
  const emptyEl = document.getElementById("empty");

  const norm = (s) => (s || "").toLocaleLowerCase("tr");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = norm(searchInput.value.trim());
      let visible = 0;
      for (const card of cards) {
        const show = !query || (card.dataset.search || "").indexOf(query) !== -1;
        card.hidden = !show;
        if (show) visible++;
      }
      emptyEl.hidden = visible !== 0;
    });
  }

  const CACHE_TTL = 60 * 60 * 1000;
  function readCache(apiUrl) {
    try {
      const obj = JSON.parse(localStorage.getItem(`lemmyi:${apiUrl}`));
      if (obj && Date.now() - obj.t < CACHE_TTL) return obj.icon;
    } catch {}
    return null;
  }
  function writeCache(apiUrl, icon) {
    try {
      localStorage.setItem(`lemmyi:${apiUrl}`, JSON.stringify({ t: Date.now(), icon: icon || "" }));
    } catch {}
  }

  const inflight = new Map();
  async function fetchIcon(apiUrl) {
    if (inflight.has(apiUrl)) return inflight.get(apiUrl);
    const promise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(apiUrl, { signal: controller.signal });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.community_view?.community?.icon || null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    inflight.set(apiUrl, promise);
    return promise;
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

  function applyIcon(el, iconUrl) {
    if (!iconUrl || el.dataset.painted === iconUrl) return;
    const safe = safeImageUrl(optimize(iconUrl));
    if (!safe) return;
    el.dataset.painted = iconUrl;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url(${JSON.stringify(safe)})`;
      el.classList.add("loaded");
    };
    img.src = safe;
  }

  function initIcon(el) {
    el.textContent = el.dataset.initial || "";
    const apiUrl = el.dataset.api;
    if (!apiUrl) return;
    const cached = readCache(apiUrl);
    if (cached) applyIcon(el, cached);
  }

  function revalidate(el) {
    const apiUrl = el.dataset.api;
    if (!apiUrl) return;
    fetchIcon(apiUrl).then((iconUrl) => {
      writeCache(apiUrl, iconUrl);
      applyIcon(el, iconUrl);
    });
  }

  const iconEls = Array.from(list.querySelectorAll(".card-icon"));
  iconEls.forEach(initIcon);

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            revalidate(entry.target);
            obs.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "200px" }
    );
    iconEls.forEach((el) => io.observe(el));
  } else {
    iconEls.forEach(revalidate);
  }
})();
