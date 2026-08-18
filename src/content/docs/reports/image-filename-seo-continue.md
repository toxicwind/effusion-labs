# Continuation – Image Filename SEO

## Context Recap

Eleventy image transform now produces slugified filenames and writes to the configured output
directory.

## Outstanding Items

1. Evaluate responsive width generation for small images.
2. Extend slugified naming to additional asset types.

## Execution Strategy

Adjust width configuration or introduce upscaling policy and add further integration tests covering
more assets.

## Trigger Command

node --test test/integration/image-filename.spec.mjs
