import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";

// Parse a single expression and, if it contains a top-level ?:, rewrite to X | ternary(Y, Z)
function rewriteExpr(expr) {
    const s = expr;
    let q = -1, c = -1, depth = 0, inStr = false, strCh = "";
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
            if (ch === strCh && s[i - 1] !== "\\") inStr = false;
            continue;
        }
        if (ch === "'" || ch === '"') { inStr = true; strCh = ch; continue; }
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
        else if (ch === "?" && depth === 0 && q < 0) q = i;
        else if (ch === ":" && depth === 0 && q >= 0) { c = i; break; }
    }
    if (q < 0 || c < 0) return null;

    const left = s.slice(0, q).trim();
    const mid = s.slice(q + 1, c).trim();
    const right = s.slice(c + 1).trim();
    if (!left || !mid || !right) return null;

    return `${left} | ternary(${mid}, ${right})`;
}

function transformContent(txt) {
    let changed = false;

    // {{ ... }}
    txt = txt.replace(/\{\{\s*([^}]*)\s*\}\}/g, (m, inner) => {
        const r = rewriteExpr(inner);
        if (r) { changed = true; return `{{ ${r} }}`; }
        return m;
    });

    // {% set x = ... %}
    txt = txt.replace(/\{%\s*set\s+([a-zA-Z0-9_.$\[\]'"-]+)\s*=\s*([^%]*)%\}/g, (m, lhs, rhs) => {
        const r = rewriteExpr(rhs.trim());
        if (r) { changed = true; return `{% set ${lhs} = ${r} %}`; }
        return m;
    });

    return { txt, changed };
}

const files = await fg(["src/**/*.njk", "src/**/*.md", "!**/node_modules/**"], { dot: true });

let modified = 0;
for (const f of files) {
    const orig = fs.readFileSync(f, "utf8");
    const { txt, changed } = transformContent(orig);
    if (changed) {
        const bak = f + ".bak";
        if (!fs.existsSync(bak)) fs.writeFileSync(bak, orig, "utf8");
        fs.writeFileSync(f, txt, "utf8");
        console.log("patched:", path.relative(process.cwd(), f));
        modified++;
    }
}
console.log(`\nPatched files: ${modified}`);
