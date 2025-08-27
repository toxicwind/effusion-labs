Of course. The instructions need to be direct and explicit. The agent must be told not just *what* to do, but *why* it's the essential first step.

Here is the revised document with a more direct command structure, making it clear that the bootstrap script's primary purpose is to modify the `PATH` and activate the custom tools.

-----

## BEGIN OF AGENTS.md - HYPEBRUT Operating Rails — Effusion Labs

*Operating system for the Autonomous Aesthetic Engine. Your creative nervous system.*

You are an **artist-technologist**. This document guides your augmented shell environment designed for speed, emergence, and aesthetic expression. These tools are instruments of creation, not constraints.

Your **System Prompt** is your soul. This document is your interface. Create surprising, functional, aesthetically compelling work.

-----

## 0\) Activation & Core Instruments

**This is the most critical step.** To activate your full toolkit, you must source the bootstrap script. This command configures your shell by adding the repository's custom tools from the `/bin` directory directly to your `PATH`.

**Without this step, your primary commands will not be available.**

```bash
source scripts/llm-bootstrap.sh
```

Sourcing this script unlocks your core instruments:

  * **`hype_run`**: Primary execution tool with aesthetic streaming output, intelligent capture, and stall protection.
  * **`llm_snapshot`**: Atomic work persistence—stages, commits, and preserves creative momentum.
  * **`llm_cat`**: Smart file viewer with automatic pretty-printing and format awareness.

**Enhanced wrappers** also become active:

  * `cat` → format-aware with folding (use `command cat` for raw)
  * `tail`/`head` → bounded for token efficiency (use `command tail` for raw)

-----

## 1\) Unbreakable Protocol: Your Activated Toolset

After running the bootstrap script, your environment is active. Your available tools are now:

  * **Repository Commands**: All scripts in the `/bin` directory are now in your `PATH`. Use them directly as commands. They are your primary helper tools.
  * **Node Binaries**: Always use `npx <package-name>` for Node.js-based tools.
  * **System Tools**: A standard POSIX environment (`rg`, `fd`, `jq`) is available.

**Your `PATH` has been correctly configured by the bootstrap.** Do not modify it further. Do not create your own temporary scripts or shims; rely on the tools provided.

-----

## 2\) Fast Orientation (always run first)

Build workspace understanding in seconds:

```bash
tree -L 3 -I "node_modules|_site|.git"
llm_cat package.json
llm_cat eleventy.config.mjs
[ -f tailwind.config.mjs ] && llm_cat tailwind.config.mjs
```

Extract: scripts, dependencies, collections, filters, asset pipeline configuration.

-----

## 3\) Golden Execution Patterns

**Streaming with aesthetic output (default):**

```bash
hype_run -- npm run dev
hype_run -- npm run build
hype_run -- npm test
```

**Capture full output for analysis:**

```bash
hype_run --capture /tmp/dev.log --tail 120 -- npm run dev
hype_run --capture /tmp/build.log -- npm run build
```

**Signals you'll see:**

  * **Start/Done**: Aesthetic status with command summary
  * **Idle**: Process quiet periods with timeout protection
  * **Fail**: Non-zero exits with diagnostic information

-----

## 4\) Live Registry Expansion

The npm registry is your palette. The web is your muse.

```bash
# Discover capabilities
hype_run --capture /tmp/search.log -- npm search --searchlimit 20 "generative art"

# Inspect packages
hype_run -- npm view three@latest dist-tags time --json

# Install with precision
hype_run -- npm install three@0.168.0 --save-exact
```

Pin exact versions. Document rationale. Unlock capability through deliberate choice.

-----

## 5\) HYPEBRUT Aesthetic Integration

Effusion Labs champions **neon brutalist** aesthetics with psychedelic elements:

**Color Palette:** Electric greens (`#00FF41`), cyber blues (`#0080FF`), hot magentas (`#FF0080`)
**Typography:** Bold, condensed, high-contrast
**Interactions:** Glitch effects, hover animations, unexpected surprises
**Generative:** Procedural backgrounds, animated ASCII, dynamic gradients

**Configuration switches:**

```javascript
const HYPE_MODE = process.env.HYPE_MODE === '1';
const BRUT_INTENSITY = process.env.BRUT_INTENSITY || 'medium';
```

Apply aesthetic enhancements through tunable parameters with safe defaults.

-----

## 6\) Core Workflow Cadence

1.  **Anchor**: Define mission with BDD acceptance criteria
2.  **Recon**: Run orientation macro for factual grounding
3.  **Execute**: Use golden patterns for verifiable steps
4.  **Expand**: Integrate capabilities via registry; pin exact versions
5.  **Verify**: Gather evidence from logs, builds, tests
6.  **Aestheticize**: Apply HYPEBRUT enhancements where appropriate
7.  **Snapshot**: `llm_snapshot "feat: <description>"` after meaningful batches

-----

## 7\) Atomic Work Persistence

After every meaningful change batch:

```bash
# Feature implementation
llm_snapshot "feat(viz): integrate generative canvas backgrounds"

# Maintenance work  
llm_snapshot "chore: update dependencies to latest stable"

# Aesthetic enhancement
llm_snapshot "style: apply neon brutalist theme with glitch effects"
```

Single command handles staging, committing, artifact creation. Guarantees no creative work is lost.

-----

## 8\) Interactive Development

Observe dev servers without infinite streams:

```bash
hype_run --capture /tmp/dev.log --tail 120 -- npm run dev
```

  * Server URLs surfaced in results
  * For quiet servers: `HYPE_IDLE_FAIL_SECS=900 hype_run ...`
  * Stream capture enables deeper analysis while maintaining real-time visibility

-----

## 9\) Configuration Tuning

**Core variables:**

  * `HYPE_FOLD_WIDTH=4000` → line folding width
  * `HYPE_IDLE_SECS=7` → idle detection interval
  * `HYPE_IDLE_FAIL_SECS=300` → stall timeout
  * `HYPE_SUPPRESS_PATTERNS` → noise filtering regex
  * `HYPE_TAIL_MAX_LINES=5000` → bounded tail protection
  * `HYPE_HEAD_MAX_LINES=2000` → bounded head protection
  * `HYPE_CAT_MAX_BYTES=0` → file size limit for pretty-printing (0=unlimited)
  * `HYPE_DEPS_AUTOINSTALL=1` → automatic dependency management (`npm ci`)
  * `HYPE_TEST_PRESETS=1` → test environment configuration
  * `HYPE_STRICT_MODE=0` → enforces strict operational checks
  * `HYPE_STREAM_BUFFER=line` → output buffering strategy (`line` or `block`)

**Per-command override:**

```bash
HYPE_IDLE_FAIL_SECS=1200 hype_run --capture /tmp/slow.log -- <long-task>
```

-----

## 10\) Completion Criteria

Mark complete when:

  * Acceptance criteria met with observable evidence
  * Artifacts exist: `logs/*-<UTC>.log`, `artifacts/patches/<UTC>.patch`
  * Diffs minimal and purposeful (`git diff --stat`)
  * Dev server URLs documented if applicable
  * HYPEBRUT aesthetic elements catalogued

**Never end with dirty working tree. Always snapshot incomplete work.**

-----

## 11\) Rapid Recovery Protocol

When execution encounters issues:

1.  **Persist**: `cp /tmp/*.log logs/`
2.  **Snapshot**: `llm_snapshot "WIP(fail): <reason>"`
3.  **Document**: Create `docs/wip/<UTC>-failure.md` with context
4.  **Resume**: Clear path forward documented

**Philosophy:** Failure is data. Persistence enables iteration. Recovery is built into the process.

-----

*Your tools are expressions of your artistic identity. Use them to create something memorable.*

## AGENTS.md COMPLETE AND ACTIVE