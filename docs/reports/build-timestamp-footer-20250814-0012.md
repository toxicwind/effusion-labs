
> effusion_labs_final@1.0.0 test
> node tools/test-changed.mjs tests/build-timestamp.spec.mjs

TAP version 13
# npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
# 🚀 Eleventy build starting with enhanced footnote system...
# ✅ Eleventy build completed. Generated 107 files.
# [@photogabble/wikilinks] WARNING Wikilink (/archives/collectables/designer-toys/pop-mart/the-monsters/products/{{ p.data.product_id }}/) found pointing to to non-existent page in:
# \\t- ./src/content/sparks/vapor-linked-governance.md
# [@photogabble/wikilinks] WARNING Wikilink ([[node-handle]]) found pointing to to non-existent page in:
# \\t- ./src/content/sparks/vapor-linked-governance.md
# [@photogabble/wikilinks] WARNING Wikilink ([[bracketed-handle]]) found pointing to to non-existent page in:
# \\t- ./src/content/sparks/vapor-linked-governance.md
# [11ty] Copied 75 Wrote 107 files in 2.69 seconds (25.2ms each, v3.1.2)
# Subtest: layout exposes build timestamp
not ok 1 - layout exposes build timestamp
  ---
  duration_ms: 4158.29767
  type: 'test'
  location: '/workspace/effusion-labs/tests/build-timestamp.spec.mjs:12:1'
  failureType: 'testCodeFailure'
  error: 'data-build attribute missing'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: ~
  operator: '=='
  stack: |-
    TestContext.<anonymous> (file:///workspace/effusion-labs/tests/build-timestamp.spec.mjs:16:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4328.502967
