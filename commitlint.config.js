// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  // Allow every commit message (commitlint used only for optional soft reporting)
  ignores: [() => true],
  rules: {
    'type-empty': [0],
    'subject-empty': [0],
    'subject-full-stop': [0],
  },
}
