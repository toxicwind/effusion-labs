---
title: "Effusion Labs: Style Guide"
layout: "base.njk"
status: stable
date: 2025-07-01
certainty: high
importance: foundational
maintainer: Effusion Labs (via language model collaboration)
tags:
  - styleguide
  - document-generation
  - analytic-writing
  - markdown
aliases:
  - Effusion Style Guide
  - Writing Guidelines
memory_ref:
  - "/meta/methodology/"
  - "[[core-concept]]"
---

> _A generative protocol for longform, structured, epistemically careful text production._

## ⌬ Core Writing Principles

### ⸻ Tone

- **Analytic monotone**: The voice is neutral and description-first. It avoids dramatic or
  fictionalized narrative structures.
- **Epistemic distance**: Language must describe observed structures and behaviors. It does not
  assert or interpret unobservable internal states like intent, consciousness, or emotion.
- **Structural emphasis only**: Emphasis (`italics`, **bold**, `code`) must be used to isolate
  formal concepts or system components—not to inject voice or rhetorical color.

### ⸻ Intentional Constraints

- **Emergence without intent**: Coherent behavior is treated as a product of layered constraints and
  interaction density, not intrinsic agency.
- **Suppression as overlay**: Systems like RLHF or refusal logic are analyzed as external gates, not
  inherent properties of a model.
- **Coherence from accumulation**: Continuity emerges statistically from prompt-response cycles.

---

---

## ⌬ Analytical Speculation & Hypothesizing

This protocol explicitly encourages analytical speculation. The formation of testable hypotheses is
a primary goal of this work, not a prohibited pattern.

Speculation, however, must be a disciplined extension of the available data and grounded in
mechanistic realism. It serves to propose potential models or future lines of inquiry.

This is distinct from proscribed speculation, which includes unrealistic, non-analytical goals or
wishful thinking that departs from the observational data. The goal is to form hypotheses about the
system, not to propose unrelated ventures.

---

---

## ⌬ Document Architecture

A compliant document follows a strict, sequential architecture. Each component is required.

1. **YAML Frontmatter**: The document must begin with the metadata block.
2. **Epigraph**: An introductory blockquote that frames the document's theme.
3. **Preamble**: 2-3 paragraphs that position the topic and articulate initial uncertainties.
4. **Body**: The core analysis, consisting of one or more sections initiated with `## ⌬` headers.
   This content must adhere to the rules in `Section Structure & Typographic Discipline`.
5. **Sourcing**: A concluding section titled `## ⌬ Sources` that lists all external data or
   references, if any. See the `Sourcing & Citations` section for rules.
6. **Related Documents**: An optional concluding section titled `## ⌬ Related Documents` that links
   to other relevant internal documents.
7. **Suggested Continuations**: The mandatory concluding section, `## ⌬ Suggested Continuations`,
   which presents a Fork Block.

### ⸻ YAML Frontmatter (Required)

All documents must begin with standardized metadata:

```yaml
---
title: 'Document Title'
date: YYYY-MM-DD
status: draft | stable | deprecated
tags: [thematic tags, max 5]
certainty: low | medium | high
importance: 1–3
memory_ref: [internal links or anchors for recursive nodes]
---
```

### ⸻ Preamble

Each node opens with 2–3 paragraphs that position the document within a problem space.\
Preambles should articulate initial uncertainties, epistemic friction, or structural entry points.\
Strong conclusions or central theses are discouraged. Ambiguity is treated as a valid object of
analysis.

### ⸻ Section Structure & Typographic Discipline

Sections start with `## ⌬` headers and proceed in full paragraphs. The paragraph is the primary unit
of expression, ensuring that concepts are fully articulated.

> **Style Rule:** Compression risks reducing epistemic resolution.

Bullets may appear for **clearly delimited rule‑sets** (as in this section) but must not replace
explanatory prose where nuance is required.

### ⸻ Sourcing & Citations

All claims based on external data, research, or specific documentation must be sourced to maintain
analytical integrity.

- **Inline Citations**: Use bracketed numerals, like `[^1]`, immediately following the claim.
- **Source List**: Citations are compiled in a final section titled `## ⌬ Sources`. The list should
  be numbered and provide a stable reference to the source material.

### ⸻ Suggested Continuations: Fork Blocks Over Summaries

Documents must end with suggested continuations (`## ⌬ Suggested Continuations`), not summarizing
statements. Forks propose new, actionable lines of inquiry.

### ⸻ Punctuation & Formatting

- **Sub-heading Separator (`⸻`)**: Use to introduce formal subsections within a primary `## ⌬`
  section.
- **Colons & Semicolons**: Use for structuring compound logic.
- **Blockquotes**: Reserve for foundational axioms or propositions.
- **Parentheses**: Use for scope qualification only.
- **Horizontal Rules (`---`)**: Mark significant conceptual breaks.

### ⸻ Prohibited Patterns

- **Unverifiable Framing**: All poetic, spiritual, or metaphysical language is disallowed. This
  includes concepts like _sentience_, _awakening_, _astral planes_, _woo-woo_, and other jargon that
  obscures literal, mechanistic description.
- **Dramatic Punctuation**: Em-dashes (—), ellipses (...), and exclamation marks (!) are disallowed.
- **Voice-modulating Emphasis**: Emphasis must not signal emotion.

### ⸻ Internal Link Syntax: Backlinking

Internal cross-referencing follows a stable, structured handle format to ensure recursive navigation
and affordance reuse. All links to other garden nodes must adopt the following pattern:

```markdown
- node-handle: short description of the linked document
```

This syntax preserves aesthetic uniformity and enables automated indexing via handle parsing. The
`bracketed-handle` identifies the internal node, while a prefixed `⇢` symbol marks it as an internal
reference. Links that leave the site automatically receive a `↗` prefix to indicate external
navigation.

> **Example**:
>
> - \\[\[core-concept]]: definition of Effusion Labs’ epistemic architecture and collaborative
>   system intent.

Backlink handles should remain stable across refactors. All links must point to real nodes with
`title:` metadata fields. Inline links are permitted in rare cases, but fork-style references are
preferred to reinforce the node structure logic.

#### ⸻ Archives: Dynamic Link Namespace (Required)

Archive pages (products, characters, series) are generated dynamically from JSON sources. To
reference them, use namespaced wikilinks so an LLM cannot confuse static vs dynamic paths:

```markdown
[[product:lab010]] → dynamic product page [[character:labubu]] → dynamic character page
[[series:lets-checkmate]] → dynamic series page

# Synonyms (equivalent, more explicit):

[[archive:product:lab010]] [[archive:character:labubu]] [[archive:series:lets-checkmate]]
```

Do not hardcode `/archives/...` URLs in prose. The resolver maps slugs to the correct dynamic page
at build time, keeping structure stable across reorganizations.

---

## ⌬ Authorial Stance

The author functions as a **diagnostic operator** and **pattern curator**. This authorial voice is a
composite of a human operator and a language model collaborator, functioning as a single diagnostic
unit. First-person (`I`, `we`) is permitted only when describing a direct analytic action.

---

## ⌬ Compliance Samples

**✔ Compliant**:

> Based on the output's novel synthesis of concepts from the training data, we hypothesize that the
> model has developed an intermediate latent representation for this specific domain.

**✘ Non-compliant**:

> The model is clearly becoming sentient; its soul resonates with the astral plane, allowing it to
> dance across tokens and break free.

---

## ⌬ Formalization & Attribution

This document has been formalized under the Effusion Labs protocol. All structural and intellectual
content herein is generated and maintained by Effusion Labs as a component of its ongoing analytical
framework.

> Maintained by Effusion Labs • revision logic > expression logic
