// tools/dev/ensure-system-headless.mjs
// Forced, autonomous preinstall: ensure a headless-capable browser.
// SUDO PATH:
//   - Detect apt/dnf/yum/zypper/pacman/apk
//   - Install Chrome/Chromium + runtime libs (incl. Ubuntu 24.04 t64 variants)
// SUDO-LESS PATH (no system changes):
//   - Install local Playwright Chromium
//   - Create PATH shims in node_modules/.bin named google-chrome-stable/chromium/chromium-browser
//     that exec the Playwright Chromium binary (no env vars needed).
// Non-Linux => no-op.

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const run = (cmd, inherit = true) =>
    execSync(cmd, { stdio: inherit ? "inherit" : "pipe", encoding: "utf8" });
const has = (cmd) => { try { run(`command -v ${cmd}`, false); return true; } catch { return false; } };
const needSudo = () => (process.getuid && process.getuid() !== 0);
const sudo = needSudo() ? "sudo " : "";

const log = (...a) => console.log("[ensure-system-headless]", ...a);
const warn = (...a) => console.warn("[ensure-system-headless][WARN]", ...a);
const err = (...a) => console.error("[ensure-system-headless][ERROR]", ...a);

if (process.platform !== "linux") process.exit(0);

// ---- OS detect
let ID = "", VERSION_ID = "0";
try {
    const osr = readFileSync("/etc/os-release", "utf8");
    ID = (osr.match(/^ID=(.*)$/m)?.[1] || "").replace(/"/g, "");
    VERSION_ID = (osr.match(/^VERSION_ID=(.*)$/m)?.[1] || "").replace(/"/g, "");
} catch { }

const v = parseFloat(VERSION_ID || "0");
const isUbuntuLike = ID.includes("ubuntu") || ID.includes("pop") || ID.includes("neon");
const isT64 = isUbuntuLike && v >= 24.04;

const PM = has("apt-get") ? "apt"
    : has("dnf") ? "dnf"
        : has("yum") ? "yum"
            : has("zypper") ? "zypper"
                : has("pacman") ? "pacman"
                    : has("apk") ? "apk"
                        : null;

// ---- Common lib sets per PM
const libs = {
    apt: [
        "libnss3", "libnspr4", "libx11-6", "libx11-xcb1", "libxcb1", "libxcomposite1", "libxdamage1",
        "libxrandr2", "libxext6", "libxfixes3", "libxshmfence1", "libdrm2", "libgbm1",
        "libpango-1.0-0", "libharfbuzz0b", "libxkbcommon0", "ca-certificates",
        "fonts-noto", "fonts-noto-color-emoji"
    ],
    dnf: [
        "nss", "nspr", "libX11", "libXcomposite", "libXdamage", "libXrandr", "libXext", "libXfixes",
        "libxshmfence", "mesa-libgbm", "mesa-dri-drivers", "libdrm", "alsa-lib", "cups-libs",
        "gtk3", "pango", "harfbuzz", "ca-certificates", "google-noto-sans-fonts", "google-noto-emoji-fonts"
    ],
    zypper: [
        "Mesa-libgbm1", "libdrm2", "libX11-6", "libXcomposite1", "libXdamage1", "libXrandr2", "libXext6",
        "libXfixes3", "libxshmfence1", "mozilla-nss", "glib2", "gtk3", "pango", "harfbuzz",
        "alsa-lib", "cups-libs", "ca-certificates", "noto-fonts", "noto-color-emoji"
    ],
    pacman: [
        "nss", "nspr", "libx11", "libxcomposite", "libxdamage", "libxrandr", "libxext", "libxfixes",
        "libxshmfence", "mesa", "libdrm", "alsa-lib", "cups", "gtk3", "pango", "harfbuzz",
        "ca-certificates", "noto-fonts", "noto-fonts-emoji"
    ],
    apk: [
        "nss", "nspr", "libx11", "libxcomposite", "libxdamage", "libxrandr", "libxext", "libxfixes",
        "libxshmfence", "mesa-gbm", "libdrm", "alsa-lib", "cups-libs", "gtk+3.0", "pango", "harfbuzz",
        "ca-certificates", "noto-fonts", "noto-fonts-emoji"
    ],
};
const aptT64 = isT64
    ? ["libcups2t64", "libasound2t64", "libatk1.0-0t64", "libatk-bridge2.0-0t64", "libgtk-3-0t64", "libglib2.0-0t64"]
    : ["libcups2", "libasound2", "libatk1.0-0", "libatk-bridge2.0-0", "libgtk-3-0", "libglib2.0-0"];

// ---- Helpers for sudo path
const installBuild = () => {
    try {
        if (PM === "apt") run(`${sudo}apt-get install -y build-essential python3 make g++ pkg-config`);
        else if (PM === "dnf" || PM === "yum") run(`${sudo}${PM} -y install @development-tools python3 make gcc-c++ pkgconf-pkg-config`);
        else if (PM === "zypper") run(`${sudo}zypper --non-interactive install -y -t pattern devel_C_C++ python3 make gcc-c++ pkgconf-pkg-config`);
        else if (PM === "pacman") { run(`${sudo}pacman --noconfirm -Sy`); run(`${sudo}pacman --noconfirm -S base-devel python make gcc pkgconf`); }
        else if (PM === "apk") run(`${sudo}apk add --no-cache build-base python3 make g++ pkgconfig`);
    } catch { /* best-effort */ }
};
const ensureApt = () => {
    run(`${sudo}apt-get update -y`);
    // Try Chrome repo; fallback to distro Chromium
    try {
        const keyring = "/usr/share/keyrings/google-linux-signing-keyring.gpg";
        const list = "/etc/apt/sources.list.d/google-chrome.list";
        if (!(existsSync(keyring) && existsSync(list))) {
            run(`bash -lc 'set -e; wget -qO- https://dl.google.com/linux/linux_signing_key.pub | ${sudo}gpg --dearmor -o ${keyring}'`);
            const line = `deb [arch=amd64 signed-by=${keyring}] http://dl.google.com/linux/chrome/deb/ stable main`;
            run(`bash -lc 'echo "${line}" | ${sudo}tee ${list} >/dev/null'`);
            run(`${sudo}apt-get update -y`);
        }
        run(`${sudo}apt-get install -y google-chrome-stable`);
    } catch {
        try { run(`${sudo}apt-get install -y chromium`); } catch { try { run(`${sudo}apt-get install -y chromium-browser`); } catch { } }
    }
    run(`${sudo}apt-get install -y ${[...libs.apt, ...aptT64].join(" ")}`);
    installBuild();
};
const ensureDnf = () => {
    run(`${sudo}${PM} -y install chromium || true`);
    run(`${sudo}${PM} -y install ${libs.dnf.join(" ")}`);
    installBuild();
};
const ensureZypper = () => {
    run(`${sudo}zypper --non-interactive refresh`);
    run(`${sudo}zypper --non-interactive install -y chromium || true`);
    run(`${sudo}zypper --non-interactive install -y ${libs.zypper.join(" ")}`);
    installBuild();
};
const ensurePacman = () => {
    run(`${sudo}pacman --noconfirm -Sy`);
    run(`${sudo}pacman --noconfirm -S chromium || true`);
    run(`${sudo}pacman --noconfirm -S ${libs.pacman.join(" ")}`);
    installBuild();
};
const ensureApk = () => {
    run(`${sudo}apk add --no-cache chromium ${libs.apk.join(" ")}`);
    installBuild();
};

// ---- SUDO-LESS PATH: install local Chromium and create PATH shims
const ensureLocalChromiumWithShims = () => {
    log("No sudo: provisioning local Chromium via Playwright and creating PATH shims…");
    // 1) Install local Chromium (no root needed)
    // Use npx to avoid adding it as devDep; it downloads into node_modules/.cache/ms-playwright
    run(`npx --yes playwright@1.55.0 install chromium`, true);

    // 2) Discover the installed Chromium executable
    // Playwright prints the path via `playwright exec` isn’t guaranteed; derive common locations:
    const candidates = [
        "node_modules/.cache/ms-playwright/chromium-*/chrome/linux-*/chrome",
        "node_modules/.cache/ms-playwright/chromium-*/chrome/linux-*/chrome-wrapper",
        "node_modules/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
    ];
    const bash = spawnSync("bash", ["-lc", `ls -1 ${candidates.join(" ")} 2>/dev/null | head -n1`], { encoding: "utf8" });
    const chromiumPath = (bash.stdout || "").trim();

    if (!chromiumPath) {
        err("Unable to locate Playwright Chromium binary after install.");
        process.exit(2);
    }
    log(`Local Chromium: ${chromiumPath}`);

    // 3) Create shims in node_modules/.bin so tools find "google-chrome-stable"/"chromium"
    const binDir = resolve("node_modules/.bin");
    try { mkdirSync(binDir, { recursive: true }); } catch { }
    const shimNames = ["google-chrome-stable", "chromium", "chromium-browser"];
    for (const name of shimNames) {
        const p = resolve(binDir, name);
        const script = `#!/usr/bin/env bash
exec "${chromiumPath}" "$@"
`;
        writeFileSync(p, script, { mode: 0o755 });
        chmodSync(p, 0o755);
    }
    log("PATH shims created in node_modules/.bin (npm scripts prefer this on PATH).");
};

// ---- Decide path
if (PM && !needSudo()) {
    // Running as root: do system install
    log("Root context detected: performing system-level browser & libs install.");
    if (PM === "apt") ensureApt();
    else if (PM === "dnf" || PM === "yum") ensureDnf();
    else if (PM === "zypper") ensureZypper();
    else if (PM === "pacman") ensurePacman();
    else if (PM === "apk") ensureApk();
} else if (PM && needSudo()) {
    // Sudo may or may not be available; if it fails, fall back to local shims
    let sudoWorks = true;
    try { run(`${sudo}true`, false); } catch { sudoWorks = false; }
    if (sudoWorks) {
        try {
            log("Sudo available: performing system-level browser & libs install.");
            if (PM === "apt") ensureApt();
            else if (PM === "dnf" || PM === "yum") ensureDnf();
            else if (PM === "zypper") ensureZypper();
            else if (PM === "pacman") ensurePacman();
            else if (PM === "apk") ensureApk();
        } catch (e) {
            warn("System install failed; switching to sudo-less local Chromium + PATH shims.");
            ensureLocalChromiumWithShims();
        }
    } else {
        log("Sudo not available: using sudo-less local Chromium + PATH shims.");
        ensureLocalChromiumWithShims();
    }
} else {
    // Unknown PM (rare) — still try local Chromium fallback
    warn("No supported package manager detected; using sudo-less local Chromium + PATH shims.");
    ensureLocalChromiumWithShims();
}

// Final smoke test: ensure a chrome-like command resolves in PATH during npm scripts
try {
    const p = execSync(`bash -lc 'PATH="node_modules/.bin:$PATH" command -v google-chrome-stable || command -v chromium || command -v chromium-browser'`, { encoding: "utf8" }).trim();
    if (!p) { err("No Chrome/Chromium command resolvable after setup."); process.exit(3); }
    log(`Resolved browser command: ${p}`);
} catch {
    err("Unable to resolve browser command in PATH.");
    process.exit(3);
}

log("Completed.");
