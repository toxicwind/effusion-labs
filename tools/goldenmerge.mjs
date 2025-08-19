#!/usr/bin/env node
import fs from "fs/promises";
import fss from "fs";
import path from "path";

const DEFAULT_ARCHIVES_ROOT = path.join(process.cwd(), "src/content/archives");
// -------------------- CLI --------------------
const args = new Set(process.argv.slice(2));
const options = {
  dryRun: args.has("--dry-run"),
  verbose: args.has("--verbose") || args.has("-v"),
  goldenPath: process.argv.find((a) => a.startsWith("--golden="))?.split("=")[1] || "golden.json",
};

// -------------------- utils --------------------
const toStr = (v) => (v == null ? "" : String(v));
const stripPunct = (s) => toStr(s).trim().replace(/^[“"']+|[”"']+$/g, "").replace(/[。．·•・・]+$/g, "").replace(/[.,;:!?、。]+$/g, "").trim();
const clean = (v) => stripPunct(toStr(v).replace(/\s+/g, " ").replace(/<[^>]+>/g, ""));

const slug = (s) => clean(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const exists = (p) => {
  try {
    fss.accessSync(p, fss.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const readJSON = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const writeJSON = async (p, obj) => await fs.writeFile(p, JSON.stringify(obj, null, 2));

// Prefer longer non-empty strings
const choose = (oldVal, newVal) => {
  if (newVal == null || newVal === "") return oldVal;
  if (oldVal == null || oldVal === "") return newVal;
  const so = toStr(oldVal);
  const sn = toStr(newVal);
  return sn.length > so.length ? newVal : oldVal;
};

// -------------------- identity extraction --------------------
const KEYMAP = {
  brand: ["brand"],
  line: ["line"],
  character: ["character"],
  series: ["series"],
  product_title: ["product_title", "title", "product"],
  variant_name: ["variant_name", "variant"],
  form: ["form", "type"],
  release_date: ["release_date", "date"],
  msrp: ["msrp", "price"],
  deterministic_id: ["product_id", "sku", "deterministic_id"],
};

const pickFirst = (row, keys) => {
  for (const k of keys) {
    if (row[k] != null) return clean(row[k]);
  }
  return "";
};

const extractIdentity = (row) => {
  const idt = {
    brand: pickFirst(row, KEYMAP.brand),
    line: pickFirst(row, KEYMAP.line),
    character: pickFirst(row, KEYMAP.character),
    series: pickFirst(row, KEYMAP.series),
    product_title: pickFirst(row, KEYMAP.product_title),
    variant_name: pickFirst(row, KEYMAP.variant_name),
    form: pickFirst(row, KEYMAP.form),
    release_date: pickFirst(row, KEYMAP.release_date),
    msrp: pickFirst(row, KEYMAP.msrp),
    deterministic_id: pickFirst(row, KEYMAP.deterministic_id),
  };

  // If body is present, parse sections into keys
  if (row.body) {
    const sections = row.body.split(/\*\*/).filter(Boolean);
    for (let j = 0; j < sections.length; j += 2) {
      const secKey = clean(sections[j]).toLowerCase();
      const secVal = clean(sections[j + 1]);
      if (secKey && secVal) row[secKey] = secVal; // Add to row for merging
      // Fill idt if matching keymap
      for (const [idKey, synonyms] of Object.entries(KEYMAP)) {
        if (synonyms.includes(secKey)) idt[idKey] = secVal;
      }
    }
  }

  // Fallback inferences (e.g., from title)
  if (!idt.brand && idt.product_title.includes("POP MART")) idt.brand = "POP MART";
  if (!idt.line && idt.product_title.includes("Monsters")) idt.line = "The Monsters";

  // Normalized
  const norm = Object.fromEntries(Object.entries(idt).map(([k, v]) => [k, stripPunct(v)]));

  // Check minimal
  const have = (k) => !!norm[k] && norm[k].length > 0;
  const ok = have("brand") && (have("line") || have("series")) && (have("character") || have("product_title"));
  const missing = ok ? [] : ["brand", "line/series", "character/product_title"].filter((expr) => {
    if (expr === "line/series") return !(have("line") || have("series"));
    if (expr === "character/product_title") return !(have("character") || have("product_title"));
    return !have(expr);
  });

  return { ok, idt: norm, missing };
};

const identityKey = (idt) => [idt.brand, idt.line, idt.character, idt.series, idt.deterministic_id].map(slug).filter(Boolean).join("|");

// -------------------- scan existing --------------------
async function buildExistingIndex() {
  const files = [];
  async function walk(dir) {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && e.name.endsWith(".json")) files.push(p);
    }
  }
  await walk(DEFAULT_ARCHIVES_ROOT);
  const index = new Map();
  const byBrandLine = new Map();

  for (const f of files) {
    try {
      const obj = await readJSON(f);
      const { idt } = extractIdentity(obj);
      const key = identityKey(idt);
      if (key) index.set(key, { file: f, idt });
      const bl = `${slug(idt.brand)}|${slug(idt.line || idt.series)}`;
      if (bl) byBrandLine.set(bl, path.dirname(f));
    } catch {}
  }
  return { files, index, byBrandLine };
}

// -------------------- merging --------------------
function mergeObjects(existing, incoming) {
  const out = { ...existing };
  for (const [k, vNew] in Object.entries(incoming)) {
    out[k] = choose(out[k], vNew);
  }
  return out;
}

function targetFilename(idt) {
  const parts = [slug(idt.brand), slug(idt.line || idt.series), slug(idt.character || idt.product_title)];
  const tail = slug(idt.series || idt.product_title || idt.variant_name || idt.form);
  if (tail) parts.push(tail);
  return parts.filter(Boolean).join("--") + ".json";
}

// -------------------- main --------------------
async function main() {
  const golden = await readJSON(options.goldenPath);
  const { index, byBrandLine } = await buildExistingIndex();

  let created = 0, merged = 0, errors = 0;

  for (const row of golden) {
    const { ok, idt } = extractIdentity(row);
    if (!ok) continue;

    const key = identityKey(idt);
    const known = index.get(key);
    let targetDir = known ? path.dirname(known.file) : byBrandLine.get(`${slug(idt.brand)}|${slug(idt.line || idt.series)}`);
    if (!targetDir) targetDir = path.join(DEFAULT_ARCHIVES_ROOT, slug(idt.brand || "unknown"), slug(idt.line || idt.series || "unknown"));
    if (!options.dryRun && !exists(targetDir)) await fs.mkdir(targetDir, { recursive: true });

    const filename = targetFilename(idt);
    const absPath = path.join(targetDir, filename);

    let finalObj = row;
    if (known) finalObj = mergeObjects(await readJSON(known.file), row);
    if (!options.dryRun) await writeJSON(absPath, finalObj);
    if (known) merged++;
    else created++;
  }

  console.log(`Created: ${created}, Merged: ${merged}, Errors: ${errors}`);
}

main().catch((e) => console.error(e));