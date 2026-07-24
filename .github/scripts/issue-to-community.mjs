import { writeFileSync, existsSync, appendFileSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const HANDLE_RE = /^([a-z0-9_]{1,64})@([a-z0-9.-]+\.[a-z]{2,})$/i;
const LIMITS = { name: 80, description: 500 };
const DIR = "communities";

function parseSections(body) {
  const map = {};
  const parts = body.split(/^###[ \t]+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    let value = (nl === -1 ? "" : part.slice(nl + 1)).trim();
    if (value === "_No response_" || value === "_Yanıt yok_") value = "";
    map[heading] = value;
  }
  return map;
}

function abort(reason) {
  console.error(reason);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `ok=false\nreason=${reason}\n`);
  }
  process.exit(1);
}

function slugifyInstance(instance) {
  return instance.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const body = (process.env.ISSUE_BODY || "").replace(/\r\n/g, "\n");
const s = parseSections(body);

const raw = (s["Topluluk adresi"] || "").replace(/^!/, "").trim();
const match = HANDLE_RE.exec(raw);
if (!match) abort("INVALID_HANDLE");

const name = match[1];
const instance = match[2].toLowerCase();
const handle = `${name}@${instance}`;
const baseSlug = name.toLowerCase();

const displayName = (s["Görünen isim"] || "").slice(0, LIMITS.name).trim();
const description = (s["Açıklama"] || "").slice(0, LIMITS.description).trim();

const community = { handle };
if (displayName) community.name = displayName;
if (description) community.description = description;

let target = null;
let collision = false;
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];
for (const f of files) {
  let ex;
  try {
    ex = JSON.parse(readFileSync(path.join(DIR, f), "utf8"));
  } catch {
    continue;
  }
  const exHandle = String(ex.handle || "").replace(/^!/, "").trim();
  const at = exHandle.indexOf("@");
  if (at < 0) continue;
  const exName = exHandle.slice(0, at).toLowerCase();
  const exInstance = exHandle.slice(at + 1).toLowerCase();
  if (exHandle.toLowerCase() === handle.toLowerCase()) {
    target = f;
    break;
  }
  if (exName === baseSlug && exInstance !== instance) collision = true;
}
if (!target) target = collision ? `${baseSlug}-${slugifyInstance(instance)}.json` : `${baseSlug}.json`;

const file = path.join(DIR, target);
const existed = existsSync(file);
writeFileSync(file, JSON.stringify(community, null, 2) + "\n");

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `ok=true\nhandle=${handle}\nexisted=${existed}\nfile=${file}\n`);
}
console.log(`Wrote ${file} (existed=${existed})`);
