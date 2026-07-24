(() => {
  "use strict";

  const list = document.getElementById("list");
  if (!list) return;

  const cards = Array.from(list.querySelectorAll(".item"));
  const searchInput = document.getElementById("search");
  const emptyEl = document.getElementById("empty");
  const sortWrap = document.getElementById("sort");
  const byEl = document.getElementById("sort-by");
  const dirEl = document.getElementById("sort-dir");
  const winEl = document.getElementById("sort-window");

  const norm = (s) => (s || "").toLocaleLowerCase("tr");

  let query = "";
  function applySearch() {
    let visible = 0;
    for (const card of cards) {
      const show = !query || (card.dataset.search || "").indexOf(query) !== -1;
      card.hidden = !show;
      if (show) visible++;
    }
    if (emptyEl) emptyEl.hidden = visible !== 0;
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      query = norm(searchInput.value.trim());
      applySearch();
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
  function paintIcon(el, iconUrl) {
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

  const CACHE_TTL = 60 * 60 * 1000;
  function readCache(api) {
    try {
      const o = JSON.parse(localStorage.getItem(`lemmyd:${api}`));
      if (o && Date.now() - o.t < CACHE_TTL) return o.d;
    } catch {}
    return null;
  }
  function writeCache(api, d) {
    try {
      localStorage.setItem(`lemmyd:${api}`, JSON.stringify({ t: Date.now(), d }));
    } catch {}
  }
  function toData(json) {
    const v = json?.community_view;
    if (!v) return null;
    const c = v.community || {};
    const n = v.counts || {};
    const num = (x) => (typeof x === "number" ? x : null);
    return {
      icon: c.icon || null,
      published: c.published || null,
      subs: num(n.subscribers),
      posts: num(n.posts),
      users_active_day: num(n.users_active_day),
      users_active_week: num(n.users_active_week),
      users_active_month: num(n.users_active_month),
      users_active_half_year: num(n.users_active_half_year),
    };
  }
  async function fetchData(api) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(api, { signal: controller.signal });
      if (!res.ok) return null;
      return toData(await res.json());
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function attach(card, d) {
    if (!d) return;
    card._m = d;
    const icon = card.querySelector(".card-icon");
    if (icon && d.icon) paintIcon(icon, d.icon);
  }

  for (const card of cards) {
    const icon = card.querySelector(".card-icon");
    if (icon) icon.textContent = icon.dataset.initial || "";
  }

  const DIRS = {
    name: [["asc", "A–Z"], ["desc", "Z–A"]],
    subs: [["desc", "En çok"], ["asc", "En az"]],
    active: [["desc", "En çok"], ["asc", "En az"]],
    posts: [["desc", "En çok"], ["asc", "En az"]],
    created: [["desc", "En yeni"], ["asc", "En eski"]],
  };

  function keyOf(card, by, win) {
    if (by === "name") return card.dataset.name || "";
    const m = card._m;
    if (!m) return null;
    if (by === "subs") return m.subs;
    if (by === "posts") return m.posts;
    if (by === "created") return m.published ? Date.parse(m.published) : null;
    if (by === "active") return m[win];
    return null;
  }
  function tiebreak(a, b) {
    return (a.dataset.name || "").localeCompare(b.dataset.name || "", "tr");
  }
  function applySort() {
    const by = byEl.value;
    const dir = dirEl.value;
    const win = winEl.value;
    const ordered = cards.slice().sort((a, b) => {
      let ka = keyOf(a, by, win);
      let kb = keyOf(b, by, win);
      const ma = ka === null || Number.isNaN(ka);
      const mb = kb === null || Number.isNaN(kb);
      if (ma && mb) return tiebreak(a, b);
      if (ma) return 1;
      if (mb) return -1;
      let r;
      if (by === "name") r = String(ka).localeCompare(String(kb), "tr");
      else r = ka < kb ? -1 : ka > kb ? 1 : 0;
      if (dir === "desc") r = -r;
      return r || tiebreak(a, b);
    });
    for (const card of ordered) list.appendChild(card);
  }

  function populateDir(by, selected) {
    const opts = DIRS[by] || DIRS.name;
    dirEl.innerHTML = "";
    for (const [value, label] of opts) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      dirEl.appendChild(o);
    }
    dirEl.value = selected && opts.some(([v]) => v === selected) ? selected : opts[0][0];
  }

  function initSort() {
    populateDir(byEl.value);
    winEl.hidden = byEl.value !== "active";
  }

  byEl.addEventListener("change", () => {
    populateDir(byEl.value);
    winEl.hidden = byEl.value !== "active";
    applySort();
  });
  dirEl.addEventListener("change", applySort);
  winEl.addEventListener("change", applySort);

  const items = cards
    .map((card) => ({ card, api: card.querySelector(".card-icon")?.dataset.api }))
    .filter((x) => x.api);

  for (const { card, api } of items) {
    const cached = readCache(api);
    if (cached) attach(card, cached);
  }

  initSort();
  if (sortWrap) sortWrap.hidden = false;
  applySort();

  let idx = 0;
  let running = 0;
  let done = 0;
  function pump() {
    while (running < 6 && idx < items.length) {
      const { card, api } = items[idx++];
      running++;
      fetchData(api)
        .then((d) => {
          if (d) {
            writeCache(api, d);
            attach(card, d);
          }
        })
        .finally(() => {
          running--;
          done++;
          if (done === items.length) applySort();
          else pump();
        });
    }
  }
  pump();
})();
