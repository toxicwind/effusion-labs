/**
 * Lens: Strata Debt — Forensic detection of layered technical artifact accumulation
 * Based on the Strata Debt taxonomy: four operational strata that accumulate
 * in any system surviving contact with reality for >18 months.
 *
 * Layer 1 — Hard Substrate: Code says X, docs say Y, config says Z
 * Layer 2 — Operational Mythos: "Never do X on Tuesdays" without dated source
 * Layer 3 — Redaction Scars: Orphaned params, commented creds, .bak files, half-erasures
 * Layer 4 — Surface Documentation: READMEs describing intended, not actual, behavior
 */

const MYTHOS_PATTERNS = [
  /never\s+\w+\s+(?:on|while|during|after|before)\s+/i,
  /always\s+\w+\s+(?:before|after|when|if)/i,
  /do\s+not\s+(?:restart|delete|modify|touch|change)\s+/i,
  /we\s+(?:always|never|only)\s+/i,
  / folklore /i,
  / tribal /i,
  / load-bearing /i,
];

const REDACTION_PATTERNS = [
  /\.bak\.\d+/,
  /\.bak$/,
  /#\s*REMOVE\s*ME/i,
  /#\s*TODO.*security/i,
  /#\s*FIXME.*cred/i,
  /\/\/\s*HACK/i,
  /\/\/\s*TEMP/i,
  / commented.out /i,
  / commented\s*out /i,
  /orphaned/i,
  /deprecated\s+but\s+still/i,
  /legacy\s+flag/i,
  /ghost\s+/i,
  /shadow\s+/i,
  /half.eras/i,
];

const SURFACE_DOC_PATTERNS = [
  /was\s+supposed\s+to/i,
  /intended\s+to/i,
  /designed\s+to/i,
  /should\s+(?:be|have|do)/i,
  /will\s+(?:eventually|soon|later)/i,
  /planned\s+for/i,
  /future\s+version/i,
  /not\s+yet\s+implemented/i,
  /coming\s+soon/i,
  /placeholder/i,
  /stub/i,
  /WIP/i,
  /work\s+in\s+progress/i,
];

const SUBSTRATE_MISMATCH_PATTERNS = [
  /README\.md\s+says/i,
  /docs\s+claim/i,
  /according\s+to\s+the\s+docs/i,
  /the\s+docs\s+say/i,
  /actually\s+(?:runs|uses|calls|binds)/i,
  /in\s+practice/i,
  /real\s+behavior/i,
  /what\s+it\s+actually\s+does/i,
];

function countMatches(text, patterns) {
  let count = 0;
  const matches = [];
  for (const re of patterns) {
    const found = [...text.matchAll(re)];
    count += found.length;
    if (found.length > 0) matches.push({ pattern: re.source, count: found.length });
  }
  return { count, matches };
}

function detectBakFiles(text) {
  const bakRe = /([\w\-\.]+\.bak(?:\.\d+)?)/g;
  const files = [...text.matchAll(bakRe)].map(m => m[1]);
  return [...new Set(files)];
}

function detectOrphanedConfig(text) {
  const orphanRe = /([A-Z_]+)=\s*
/g;
  return [...text.matchAll(orphanRe)].map(m => m[1]);
}

function detectCommentedCreds(text) {
  const credRe = /#\s*(?:ghp|gho|ghu|ghs|ghr|sk-|pk-|ak-)_[A-Za-z0-9_]{20,}/g;
  const apiRe = /#\s*api[_-]?key[:\s=]+['"]?[A-Za-z0-9]{20,}['"]?/gi;
  const passRe = /#\s*password[:\s=]+['"]?[^\s'"]+['"]?/gi;
  return [
    ...[...text.matchAll(credRe)].map(m => m[0]),
    ...[...text.matchAll(apiRe)].map(m => m[0]),
    ...[...text.matchAll(passRe)].map(m => m[0]),
  ];
}

function computeStrataScore(layer1, layer2, layer3, layer4) {
  const w1 = 0.25, w2 = 0.20, w3 = 0.35, w4 = 0.20;
  const score = (layer1.count * w1 + layer2.count * w2 + layer3.count * w3 + layer4.count * w4);
  return Math.min(100, Math.round(score * 10));
}

module.exports = {
  name: 'strata_debt',
  description: 'Forensic detection of layered technical artifact accumulation across four operational strata',

  analyze(data, meta = {}) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const lines = text.split('\n');

    // Layer 1 — Hard Substrate mismatches
    const l1 = countMatches(text, SUBSTRATE_MISMATCH_PATTERNS);
    const configOrphans = detectOrphanedConfig(text);
    const substrateIndicators = [...new Set([...l1.matches.map(m => m.pattern), ...configOrphans])];

    // Layer 2 — Operational Mythos
    const l2 = countMatches(text, MYTHOS_PATTERNS);
    const mythosLines = [];
    lines.forEach((line, i) => {
      for (const re of MYTHOS_PATTERNS) {
        if (re.test(line)) {
          mythosLines.push({ line: i + 1, text: line.trim().slice(0, 100) });
          break;
        }
      }
    });

    // Layer 3 — Redaction Scars
    const l3 = countMatches(text, REDACTION_PATTERNS);
    const bakFiles = detectBakFiles(text);
    const commentedCreds = detectCommentedCreds(text);
    const redactionLines = [];
    lines.forEach((line, i) => {
      for (const re of REDACTION_PATTERNS) {
        if (re.test(line)) {
          redactionLines.push({ line: i + 1, text: line.trim().slice(0, 100) });
          break;
        }
      }
    });

    // Layer 4 — Surface Documentation
    const l4 = countMatches(text, SURFACE_DOC_PATTERNS);
    const surfaceLines = [];
    lines.forEach((line, i) => {
      for (const re of SURFACE_DOC_PATTERNS) {
        if (re.test(line)) {
          surfaceLines.push({ line: i + 1, text: line.trim().slice(0, 100) });
          break;
        }
      }
    });

    const score = computeStrataScore(l1, l2, l3, l4);
    const severity = score > 70 ? 'critical' : score > 40 ? 'warning' : score > 15 ? 'moderate' : 'clean';

    return {
      lens: 'strata_debt',
      strataScore: score,
      severity,
      layers: {
        hard_substrate: {
          name: 'Hard Substrate (Plumbing)',
          count: l1.count,
          orphans: configOrphans,
          indicators: substrateIndicators,
          description: 'Mismatches between code, config, and documented behavior'
        },
        operational_mythos: {
          name: 'Operational Mythos (Team Lore)',
          count: l2.count,
          mythosLines: mythosLines.slice(0, 10),
          description: 'Unverified rules, folklore, and load-bearing superstitions'
        },
        redaction_scars: {
          name: 'Redaction Scars (Shadows)',
          count: l3.count,
          bakFiles,
          commentedCreds: commentedCreds.length,
          redactionLines: redactionLines.slice(0, 10),
          description: 'Incomplete sanitization, orphaned artifacts, half-erasures'
        },
        surface_documentation: {
          name: 'Surface Documentation (Performance)',
          count: l4.count,
          surfaceLines: surfaceLines.slice(0, 10),
          description: 'Docs describing intended behavior, not actual behavior'
        }
      },
      confidence: 0.87,
      source: meta.path || 'unknown'
    };
  }
};