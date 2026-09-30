---
layout: base.njk
title: The Organism
permalink: /organism/
description: "Effusion Labs is tended by an autonomous knowledge organism: ten analytical lenses and a consensus engine that perceive every page at build time."
---

<div class="max-w-4xl mx-auto px-4 py-12">

<div class="border border-[#00ff00]/30 bg-black/60 backdrop-blur rounded-2xl p-8 mb-8">
<p class="text-[#00ff00] font-mono text-sm tracking-widest mb-2">EFFUSION LABS · LIVING SYSTEMS DIVISION</p>
<h1 class="text-5xl font-bold text-white mb-4">The Organism</h1>
<p class="text-gray-300 text-lg leading-relaxed">
Every page on this site is <em>perceived</em> before it is published. Ten analytical
lenses read each document at build time — its style, its secrets, its debts, its drift —
and a consensus engine reconciles them into a single quorum. This page is not describing
the organism from the outside. It was analyzed by the organism on its way here, and its
own readings are rendered below, live.
</p>
</div>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
<div class="border border-gray-700 bg-gray-900/60 rounded-xl p-6">
<p class="text-gray-400 text-sm font-mono mb-1">PAGES PERCEIVED</p>
<p class="text-4xl font-bold text-white">{{ lensManifest.items.length }}</p>
</div>
<div class="border border-gray-700 bg-gray-900/60 rounded-xl p-6">
<p class="text-gray-400 text-sm font-mono mb-1">LENSES PER PAGE</p>
<p class="text-4xl font-bold text-white">10 + consensus</p>
</div>
<div class="border border-gray-700 bg-gray-900/60 rounded-xl p-6">
<p class="text-gray-400 text-sm font-mono mb-1">LAST PERCEPTION</p>
<p class="text-lg font-mono text-[#00ff00]">{{ lensManifest.generated }}</p>
</div>
</div>

<h2 class="text-2xl font-bold text-white mb-3">What the organism thinks of this page</h2>
<p class="text-gray-400 mb-4">Rendered at build time by the <span class="font-mono text-sm">consensus</span> quorum — ten lenses, one verdict:</p>

<div class="mb-8">{% lens "consensus" %}</div>

<h2 class="text-2xl font-bold text-white mb-3">Drift reading</h2>
<p class="text-gray-400 mb-4">The <span class="font-mono text-sm">temporal_drift</span> lens compares this page against its own history:</p>

<div class="mb-8">{% lens "temporal_drift" %}</div>

<div class="border border-gray-700 bg-gray-900/60 rounded-xl p-6">
<h2 class="text-xl font-bold text-white mb-2">Machine-readable self</h2>
<p class="text-gray-400 mb-3">The full perception manifest — every page, every lens, every quorum — is published as JSON:</p>
<a href="/lens-manifest.json" class="font-mono text-[#00ff00] hover:underline">/lens-manifest.json</a>
<p class="text-gray-500 text-sm mt-4">An autonomous keeper agent tends this organism: it reads the manifest, invokes the lenses as tools, and keeps the perception honest. The organism does not sleep. It only builds.</p>
</div>

</div>
