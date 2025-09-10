# Eleventy Runner Ledger

- tests/runner.spec.mjs — verifies test runner env setup.
- all existing Eleventy tests migrated to runEleventy utility.
- tools/test-ledger.json enumerates suite coverage.
- replaced network-based webpageToMarkdown tests with fixture-driven htmlToMarkdown test; removed duplicate test file.
- dropped dev server MIME tests; suite exits cleanly.

Status: 5/5 items captured.
