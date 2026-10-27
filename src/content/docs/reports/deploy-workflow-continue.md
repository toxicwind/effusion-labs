# Continuation – Deploy Workflow

## Context Recap

Build and Deploy workflow now runs only after merges to main; build job is gated to push events.

## Outstanding Items

1. Cover workflow_dispatch scenarios.
2. Document manual deployment process.

## Execution Strategy

Add tests for workflow_dispatch behavior and update README with deployment instructions.

## Trigger Command

node --test test/unit/deploy-workflow.test.mjs
