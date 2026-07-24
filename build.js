#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const COMMUNITIES_DIR = path.join(ROOT, "communities");
const SRC_DIR = path.join(ROOT, "src");
const TEMPLATES_DIR = path.join(SRC_DIR, "templates");
const DIST_DIR = path.join(ROOT, "dist");

const REPO_URL = "https://github.com/duckesteles/lemmy-dizini";

const HANDLE_RE = /^([a-z0-9_]{1,64})@([a-z0-9.-]+\.[a-z]{2,})$/i;

function fail(message) {
  console.error(`\n[build] Hata: ${message}\n`);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseHandle(handle, file) {
  const match = HANDLE_RE.exec(String(handle).trim());
  if (!match) {
    fail(`${file}: geçersiz handle "${handle}". Beklenen biçim: isim@instance.tld`);
  }
  const name = match[1].toLowerCase();
  const instance = match[2].toLowerCase();
  return {
    name,
    instance,
    apiUrl: `https://${instance}/api/v3/community?name=${encodeURIComponent(name)}`,
    communityUrl: `https://${instance}/c/${name}`,
    copyHandle: `!${name}@${instance}`,
  };
}

function slugifyInstance(instance) {
  return instance.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function loadCommunities() {
  if (!fs.existsSync(COMMUNITIES_DIR)) fail("communities/ klasörü yok.");

  const files = fs
    .readdirSync(COMMUNITIES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const byHandle = new Map();

  const communities = files.map((file) => {
    const full = path.join(COMMUNITIES_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (err) {
      fail(`${file}: JSON okunamadı — ${err.message}`);
    }
    if (!data.handle) fail(`${file}: "handle" alanı zorunlu.`);

    const parsed = parseHandle(data.handle, file);
    const handle = `${parsed.name}@${parsed.instance}`;

    if (byHandle.has(handle)) {
      fail(`Aynı topluluk iki kez tanımlı: "${handle}" (${file} ve ${byHandle.get(handle)}).`);
    }
    byHandle.set(handle, file);

    const name = (data.name ? String(data.name).trim().slice(0, 80) : "") || parsed.name;
    const description = data.description ? String(data.description).trim().slice(0, 500) : "";

    return { ...parsed, cname: parsed.name, name, description };
  });

  const nameCount = new Map();
  for (const c of communities) {
    nameCount.set(c.cname, (nameCount.get(c.cname) || 0) + 1);
  }
  for (const c of communities) {
    c.slug = nameCount.get(c.cname) > 1 ? `${c.cname}-${slugifyInstance(c.instance)}` : c.cname;
  }

  const seenSlug = new Set();
  for (const c of communities) {
    if (seenSlug.has(c.slug)) fail(`Slug çakışması: "${c.slug}".`);
    seenSlug.add(c.slug);
  }

  communities.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return communities;
}

function renderCard(c) {
  const initial = c.name.charAt(0).toUpperCase();
  const searchText = `${c.name} ${c.copyHandle} ${c.description}`.toLocaleLowerCase("tr");

  return `      <li class="item" data-search="${escapeHtml(searchText)}">
        <a class="card" href="/c/${escapeHtml(c.slug)}/">
          <span class="card-icon" data-api="${escapeHtml(c.apiUrl)}" data-initial="${escapeHtml(initial)}"></span>
          <span class="card-text">
            <span class="card-name">${escapeHtml(c.name)}</span>
            <span class="card-handle">${escapeHtml(c.copyHandle)}</span>
            ${c.description ? `<span class="card-desc">${escapeHtml(c.description)}</span>` : ""}
          </span>
        </a>
      </li>`;
}

function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
}

function renderCommunityPage(template, c) {
  const initial = c.name.charAt(0).toUpperCase();
  const descMeta = c.description || `${c.name} — Türkçe Lemmy topluluğu.`;

  return fillTemplate(template, {
    REPO: escapeHtml(REPO_URL),
    NAME: escapeHtml(c.name),
    INSTANCE: escapeHtml(c.instance),
    INITIAL: escapeHtml(initial),
    API_URL: escapeHtml(c.apiUrl),
    COMMUNITY_URL: escapeHtml(c.communityUrl),
    COPY_HANDLE: escapeHtml(c.copyHandle),
    DESCRIPTION: c.description ? escapeHtml(c.description) : "",
    DESCRIPTION_META: escapeHtml(descMeta),
  });
}

function rmDist() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function copyAssets() {
  const assetsDir = path.join(DIST_DIR, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  for (const file of ["styles.css", "home.js", "community.js", "theme.js", "lemmy.png", "favicon.png"]) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(assetsDir, file));
  }
}

function build() {
  const communities = loadCommunities();
  const indexTpl = fs.readFileSync(path.join(TEMPLATES_DIR, "index.html"), "utf8");
  const communityTpl = fs.readFileSync(path.join(TEMPLATES_DIR, "community.html"), "utf8");

  rmDist();
  copyAssets();

  const cards = communities.length
    ? communities.map(renderCard).join("\n")
    : `      <li class="empty">Henüz topluluk eklenmedi.</li>`;
  const indexHtml = fillTemplate(indexTpl, {
    REPO: escapeHtml(REPO_URL),
    CARDS: cards,
    COUNT: String(communities.length),
  });
  fs.writeFileSync(path.join(DIST_DIR, "index.html"), indexHtml);

  for (const c of communities) {
    const dir = path.join(DIST_DIR, "c", c.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderCommunityPage(communityTpl, c));
  }

  const publicIndex = communities.map((c) => ({
    name: c.name,
    handle: c.copyHandle.slice(1),
    url: c.communityUrl,
  }));
  fs.writeFileSync(
    path.join(DIST_DIR, "communities.json"),
    JSON.stringify(publicIndex, null, 2)
  );

  console.log(`[build] ${communities.length} topluluk → dist/ hazır.`);
}

build();
