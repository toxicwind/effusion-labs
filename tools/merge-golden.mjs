#!/usr/bin/env node
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_ARCHIVES_ROOT = path.join(
  repoRoot,
  "src",
  "content",
  "archives",
  "collectables",
  "designer-toys"
);

// -------------------- CLI --------------------
const args = new Set(process.argv.slice(2));
const getArgVal = (k, fallback = null) => {
  const i = process.argv.findIndex((a) => a === k);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
};

const options = {
  dryRun: args.has("--dry-run"),
  verbose: args.has("--verbose") || args.has("-v"),
  strict: args.has("--strict"), // require full identity; default false (permissive)
  goldenPath: getArgVal("--golden", null),
  showKeys: args.has("--show-keys"),
  debugRow: (() => {
    const v = getArgVal("--debug-row", null);
    return v ? Number(v) : null;
  })(),
};

// -------------------- utils --------------------
const toStr = (v) => (v == null ? "" : String(v));
const stripPunct = (s) =>
  toStr(s)
    .trim()
    // remove outer quotes and trailing sentence punctuation commonly appearing in your data
    .replace(/^[“"']+|[”"']+$/g, "")
    .replace(/[。．·•・・]+$/g, "")
    .replace(/[.,;:!?、。]+$/g, "")
    .trim();

const clean = (v) =>
  stripPunct(
    toStr(v)
      .replace(/\s+/g, " ")
      .replace(/<[^>]+>/g, "") // strip simple HTML tags if pasted
  );

const slug = (s) =>
  clean(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const exists = (p) => {
  try {
    fss.accessSync(p, fss.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const readJSON = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const writeJSON = async (p, obj) =>
  await fs.writeFile(p, JSON.stringify(obj, null, 2));

// prefer longer non-empty strings, else keep current
const choose = (oldVal, newVal) => {
  if (newVal == null || newVal === "") return { chosen: oldVal, reason: "new-empty" };
  if (oldVal == null || oldVal === "") return { chosen: newVal, reason: "old-empty" };
  const so = toStr(oldVal);
  const sn = toStr(newVal);
  if (sn.length > so.length) return { chosen: newVal, reason: "specificity" };
  if (sn !== so) return { chosen: oldVal, reason: "kept-existing" };
  return { chosen: oldVal, reason: "same" };
};

// -------------------- identity extraction --------------------
/**
 * We accept lots of synonyms. The sample golden uses:
 * brand, line, character, series, product_title, variant_name, form
 * (sometimes trailing dots)
 */
const KEYMAP = {
  brand: ["brand"],
  line: ["line"],
  character: ["character"],
  series: ["series"],
  product_title: ["product_title", "title", "product"], // tolerate "product" (seen once)
  variant_name: ["variant_name", "variant"],
  form: ["form", "type"], // some legacy used "type"
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
  };

  // minimal conditions:
  // permissive default: brand AND (line OR series) AND (character OR product_title)
  // strict mode: require brand,line,character,series,product_title
  const have = (k) => !!idt[k] && idt[k].length > 0;

  let ok;
  let missing = [];
  if (options.strict) {
    const req = ["brand", "line", "character", "series", "product_title"];
    missing = req.filter((k) => !have(k));
    ok = missing.length === 0;
  } else {
    ok = have("brand") && (have("line") || have("series")) && (have("character") || have("product_title"));
    if (!ok) {
      const req = ["brand", "(line|series)", "(character|product_title)"];
      missing = req.filter((expr) => {
        if (expr === "(line|series)") return !(have("line") || have("series"));
        if (expr === "(character|product_title)") return !(have("character") || have("product_title"));
        return !have(expr);
      });
    }
  }

  // normalized identity (punct removed)
  const norm = {
    brand: stripPunct(idt.brand),
    line: stripPunct(idt.line),
    character: stripPunct(idt.character),
    series: stripPunct(idt.series),
    product_title: stripPunct(idt.product_title),
    variant_name: stripPunct(idt.variant_name),
    form: stripPunct(idt.form),
  };

  return { ok, idt: norm, missing };
};

const identityKey = (idt) =>
  [idt.brand, idt.line, idt.character, idt.series].map((x) => slug(x)).join("|");

// -------------------- scan existing product files --------------------
const PRODUCT_GLOBS = [
  path.join(DEFAULT_ARCHIVES_ROOT, "**", "*.json"),
];

async function listJsonFiles(globRoot) {
  // lightweight recursive walk (no glob dep)
  const out = [];
  async function walk(dir) {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const e of ents) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && e.name.endsWith(".json")) out.push(p);
    }
  }
  if (exists(globRoot)) await walk(globRoot);
  return out;
}

async function buildExistingIndex() {
  const files = await listJsonFiles(DEFAULT_ARCHIVES_ROOT);
  const index = new Map(); // identityKey -> { file, idt }
  const byBrandLine = new Map(); // (brand,line) -> dir
  const topKeyCounts = new Map();

  for (const f of files) {
    try {
      const obj = await readJSON(f);
      const brand = clean(obj.brand || "");
      const line = clean(obj.line || "");
      const character = clean(obj.character || "");
      const series = clean(obj.series || "");
      const idt = {
        brand: stripPunct(brand),
        line: stripPunct(line),
        character: stripPunct(character),
        series: stripPunct(series),
      };
      if (brand && line) {
        byBrandLine.set(
          `${slug(idt.brand)}|${slug(idt.line)}`,
          path.dirname(f)
        );
      }
      if (brand && (line || series) && (character || series)) {
        index.set(identityKey(idt), { file: f, idt });
      }
      // key census
      Object.keys(obj).forEach((k) =>
        topKeyCounts.set(k, (topKeyCounts.get(k) || 0) + 1)
      );
    } catch {
      // ignore malformed json file
    }
  }
  return { files, index, byBrandLine, topKeyCounts };
}

// -------------------- find latest golden --------------------
async function findGoldenPath() {
  if (options.goldenPath) return options.goldenPath;
  const archivesDir = path.join(repoRoot, "src", "content", "archives");
  if (!exists(archivesDir)) return null;
  const files = await fs.readdir(archivesDir);
  const cands = files
    .filter((f) => f.startsWith("golden_record_") && f.endsWith(".json"))
    .map((f) => path.join(archivesDir, f))
    .sort()
    .reverse();
  return cands[0] || null;
}

// -------------------- merging --------------------
function mergeObjects(existing, incoming) {
  const out = { ...existing };
  const deltas = out.Deltas && Array.isArray(out.Deltas) ? [...out.Deltas] : [];

  for (const [k, vNew] of Object.entries(incoming)) {
    if (k === "Deltas") continue;
    const vOld = out[k];
    const { chosen, reason } = choose(vOld, vNew);
    if (reason === "specificity" || (vOld && vNew && vOld !== vNew)) {
      deltas.push({ field: k, from: vOld ?? null, to: chosen, reason });
    }
    out[k] = chosen;
  }
  if (deltas.length) out.Deltas = deltas;
  return out;
}

function targetFilename(idt) {
  // brand--line--character--(series or product_title)--(variant/form optional)
  const parts = [
    slug(idt.brand),
    slug(idt.line || idt.series),
    slug(idt.character || idt.product_title),
  ];
  const tail =
    slug(idt.series) ||
    slug(idt.product_title) ||
    slug(idt.variant_name) ||
    slug(idt.form);
  if (tail) parts.push(tail);
  return parts.filter(Boolean).join("--") + ".json";
}

// -------------------- main --------------------
async function main() {
  const start = Date.now();
  const errors = [];
  const summary = {
    willRename: 0,
    willMerge: 0,
    willCreate: 0,
    willDeleteTimestamped: 0,
    skippedNonProduct: 0,
    errors: 0,
  };

  // 1) index existing
  const { files: productFiles, index, byBrandLine, topKeyCounts } =
    await buildExistingIndex();

  // 2) golden
  const goldenPath = await findGoldenPath();
  if (!goldenPath) {
    console.error("No golden file found. Pass --golden <path>.");
    process.exit(2);
  }
  const golden = await readJSON(goldenPath);

  // Detect product-ish rows (permissive)
  const rows = [];
  const skipped = [];
  golden.forEach((row, i) => {
    const { ok, idt, missing } = extractIdentity(row);
    if (ok) rows.push({ i, idt, row });
    else skipped.push({ i, missing, row });
  });

  // 3) logging header
  console.log(`Golden used: ${path.relative(repoRoot, goldenPath)}`);
  console.log(`Product files: ${productFiles.length}`);
  console.log(`Golden product rows: ${rows.length}`);
  const identityKeys = Object.keys(KEYMAP).join(", ");
  console.log(`Identity keys accepted: ${identityKeys}`);

  if (options.showKeys) {
    const sortedKeys = [...topKeyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([k, c]) => `${k} (${c})`);
    console.log(`Top keys in existing products: ${sortedKeys.join(", ")}`);
  }

  if (options.verbose) {
    const preview = rows.slice(0, 5).map(({ i, idt }) => ({
      row: i,
      brand: idt.brand,
      line: idt.line,
      character: idt.character,
      series: idt.series,
      product_title: idt.product_title,
      variant_name: idt.variant_name,
    }));
    console.log("First product rows:", JSON.stringify(preview, null, 2));
    if (skipped.length) {
      console.log(
        `Skipped rows (not product-ish): ${skipped.length} (showing up to 5)...`
      );
      console.log(
        JSON.stringify(
          skipped.slice(0, 5).map((s) => ({ row: s.i, missing: s.missing })),
          null,
          2
        )
      );
    }
  }

  // 4) process rows
  for (const { i, idt, row } of rows) {
    try {
      const key = identityKey(idt);
      const known = index.get(key);
      let targetDir;

      // If we have an existing file with same identity, use that dir.
      if (known) targetDir = path.dirname(known.file);
      // Else, try by (brand,line) dir we saw in the index
      if (!targetDir) {
        const bl = `${slug(idt.brand)}|${slug(idt.line || idt.series)}`;
        targetDir = byBrandLine.get(bl);
      }
      // Final fallback: create a brand/line folder
      if (!targetDir) {
        targetDir = path.join(
          DEFAULT_ARCHIVES_ROOT,
          slug(idt.brand || "unknown-brand"),
          slug(idt.line || idt.series || "unknown-line")
        );
        if (!options.dryRun && !exists(targetDir)) {
          await fs.mkdir(targetDir, { recursive: true });
        }
        if (options.verbose) {
          console.log(
            `Row #${i}: created fallback dir ${path.relative(repoRoot, targetDir)}`
          );
        }
      }

      // Determine filename
      const filename = targetFilename(idt);
      const absPath = path.join(targetDir, filename);

      // Clean incoming row a bit: drop giant bodies if you want? we'll keep all by default.
      const incoming = { ...row };
      // normalize a few common aliases seen in your sample
      if (incoming.size_cm && !incoming.size) incoming.size = incoming.size_cm;
      if (incoming.msrp_currency && !incoming.currency) incoming.currency = incoming.msrp_currency;
      if (incoming.price && typeof incoming.price === "string" && !incoming.msrp) {
        // try to parse "USD 43.99" -> currency+msrp
        const m = incoming.price.match(/([A-Z]{3})\s+([\d.,]+)/);
        if (m) {
          incoming.currency = incoming.currency || m[1];
          incoming.msrp = incoming.msrp || Number(m[2].replace(/,/g, ""));
        }
      }

      let action = "create";
      let finalObj;
      if (exists(absPath)) {
        // merge into the exact file
        const existing = await readJSON(absPath);
        finalObj = mergeObjects(existing, incoming);
        action = "merge";
      } else if (known && exists(known.file)) {
        // If identity existed under different filename, merge there and optionally rename later
        const existing = await readJSON(known.file);
        finalObj = mergeObjects(existing, incoming);
        action = "merge";
        if (path.basename(known.file) !== filename) {
          // rename
          summary.willRename++;
          if (options.verbose) {
            console.log(
              `Row #${i}: will rename ${path.relative(
                repoRoot,
                known.file
              )} -> ${path.relative(repoRoot, absPath)}`
            );
          }
          if (!options.dryRun) {
            await fs.rename(known.file, absPath);
          }
        }
      } else {
        // create new file
        finalObj = incoming;
      }

      if (options.verbose) {
        console.log(
          `Row #${i}: ${action === "create" ? "WILL CREATE" : "WILL MERGE"} → ${path.relative(
            repoRoot,
            absPath
          )}`
        );
      }

      if (!options.dryRun) {
        await writeJSON(absPath, finalObj);
      }

      if (action === "create") summary.willCreate++;
      else summary.willMerge++;
    } catch (e) {
      summary.errors++;
      errors.push({ row: i, message: e?.message || String(e) });
      if (options.verbose) {
        console.error(`Row #${i}: ERROR →`, e);
      }
    }
  }

  summary.skippedNonProduct = skipped.length;

  // 5) footer
  console.log("Summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (errors.length) {
    console.log("Errors encountered:");
    errors.slice(0, 20).forEach((e) =>
      console.log(`  - row #${e.row}: ${e.message}`)
    );
    if (errors.length > 20) {
      console.log(`  ... and ${errors.length - 20} more`);
    }
  }

  if (options.debugRow != null) {
    const r = golden[options.debugRow];
    if (!r) {
      console.log(`--debug-row ${options.debugRow}: out of range`);
    } else {
      const { ok, idt, missing } = extractIdentity(r);
      console.log(
        `--debug-row ${options.debugRow} → ok=${ok} missing=${missing?.join(
          ", "
        )}`
      );
      console.log("identity:", idt);
      console.dir(r, { depth: 1, maxArrayLength: 20 });
    }
  }

  if (options.verbose) {
    console.log(`Done in ${(Date.now() - start).toLocaleString()} ms`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
