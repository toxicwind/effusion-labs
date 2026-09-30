#!/usr/bin/env bun
/**
 * Generate the downloadable resume PDF from the canonical JSON source.
 *
 * Reads src/pages/resume/resume.json, renders a standalone print-optimized
 * HTML document (inline CSS, no site pipeline dependency), and prints it to
 * src/assets/static/Christopher_Ortega_Resume_2026.pdf via headless Chromium.
 *
 * Usage: bun scripts/generate-resume-pdf.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resume = JSON.parse(
  readFileSync(join(root, "src/pages/resume/resume.json"), "utf8"),
);

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const link = (label: string, url: string) =>
  `<a href="${esc(url)}">${esc(label)}</a>`;

const experienceHtml = resume.experience
  .map((job: any) => {
    const dates = [job.start, job.end].filter(Boolean).join(" — ");
    const bullets = (job.highlights ?? [])
      .map((b: string) => `<li>${esc(b)}</li>`)
      .join("\n");
    const tags =
      job.tags?.length > 0
        ? `<div class="tags">${job.tags.map(esc).join(" · ")}</div>`
        : "";
    return `<section class="job">
      <div class="job-head">
        <div><strong>${esc(job.role)}</strong> — ${esc(job.company)}${
          job.location ? ` <span class="muted">· ${esc(job.location)}</span>` : ""
        }</div>
        <div class="dates">${esc(dates)}</div>
      </div>
      <ul>${bullets}</ul>
      ${tags}
    </section>`;
  })
  .join("\n");

const projectsHtml = resume.projects
  .map((p: any) => {
    const blurb = p.blurb ? `<p class="blurb">${esc(p.blurb)}</p>` : "";
    return `<section class="project">
      <div class="job-head">
        <div><strong>${esc(p.name)}</strong>${
          p.subtitle ? ` — <span class="muted">${esc(p.subtitle)}</span>` : ""
        }</div>
        ${p.url ? `<div class="dates">${link("link", p.url)}</div>` : ""}
      </div>
      ${blurb}
    </section>`;
  })
  .join("\n");

const skillsHtml = resume.skills.groups
  .map(
    (g: any) =>
      `<div class="skill-group"><strong>${esc(g.name)}:</strong> ${g.items
        .map((i: any) => esc(i.name ?? i))
        .join(", ")}</div>`,
  )
  .join("\n");

const toolsLine =
  resume.tools?.length > 0
    ? `<div class="skill-group"><strong>Tools:</strong> ${resume.tools
        .map(esc)
        .join(", ")}</div>`
    : "";

const highlightsHtml = (resume.highlights ?? [])
  .map(
    (h: any) =>
      `<div class="highlight"><strong>${esc(h.label)}</strong>${
        h.value ? ` — ${esc(h.value)}` : ""
      }<br><span class="muted">${esc(h.detail ?? "")}</span></div>`,
  )
  .join("\n");

const educationHtml = (resume.education ?? [])
  .map(
    (e: any) =>
      `<div><strong>${esc(e.degree)}</strong> — ${esc(e.school)}${
        e.details ? ` <span class="muted">· ${esc(e.details)}</span>` : ""
      }</div>`,
  )
  .join("\n");

const contactBits = [
  esc(resume.location),
  link(resume.email, `mailto:${resume.email}`),
  resume.linkedin ? link("LinkedIn", resume.linkedin) : "",
  resume.website ? link("Website", resume.website) : "",
  resume.github ? link("GitHub", resume.github) : "",
].filter(Boolean);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(resume.name)} — Resume</title>
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.45; color: #161616; padding: 0.55in 0.65in; }
  a { color: #1a4fa0; text-decoration: none; }
  h1 { font-size: 24pt; letter-spacing: -0.5px; margin-bottom: 1pt; }
  .headline { font-size: 11pt; color: #333; margin-bottom: 4pt; }
  .contact { font-size: 9pt; color: #444; margin-bottom: 6pt; }
  .contact a { color: #1a4fa0; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1.2px; border-bottom: 1.5px solid #222; padding-bottom: 3pt; margin: 13pt 0 7pt; }
  .summary { margin-bottom: 2pt; }
  .highlights { display: grid; grid-template-columns: 1fr 1fr; gap: 5pt 14pt; }
  .highlight { font-size: 9.5pt; }
  .muted { color: #555; }
  .job, .project { margin-bottom: 8pt; break-inside: avoid; }
  .blurb { font-size: 9.5pt; color: #333; margin-top: 2pt; }
  .job-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; margin-bottom: 2pt; }
  .dates { font-size: 9pt; color: #555; white-space: nowrap; }
  ul { margin: 3pt 0 2pt 15pt; }
  li { margin-bottom: 2.5pt; }
  .tags { font-size: 8.5pt; color: #555; margin-top: 2pt; }
  .skill-group { font-size: 9.5pt; margin-bottom: 3pt; }
  .footer { margin-top: 14pt; font-size: 8pt; color: #777; border-top: 1px solid #ccc; padding-top: 4pt; }
</style>
</head>
<body>
  <h1>${esc(resume.name)}</h1>
  <div class="headline">${esc(resume.title)}</div>
  <div class="contact">${contactBits.join(" &nbsp;·&nbsp; ")}</div>

  <h2>Summary</h2>
  <p class="summary">${esc(resume.summary)}</p>

  <h2>Highlights</h2>
  <div class="highlights">${highlightsHtml}</div>

  <h2>Experience</h2>
  ${experienceHtml}

  <h2>Selected Projects</h2>
  ${projectsHtml}

  <h2>Skills &amp; Tools</h2>
  ${skillsHtml}
  ${toolsLine}

  <h2>Education</h2>
  ${educationHtml}

  <div class="footer">Last updated: ${esc(resume.updated)} · ${esc(resume.location)}</div>
</body>
</html>`;

const tmpHtml = "/tmp/resume-print.html";
writeFileSync(tmpHtml, html);

const outPdf = join(
  root,
  "src/assets/static/Christopher_Ortega_Resume_2026.pdf",
);
await $`chromium --headless --disable-gpu --no-sandbox --print-to-pdf=${outPdf} --print-to-pdf-no-header file://${tmpHtml}`;
console.log(`wrote ${outPdf}`);
