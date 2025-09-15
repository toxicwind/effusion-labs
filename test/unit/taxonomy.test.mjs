import test from 'node:test'
import assert from 'node:assert'
import computed from '../../src/_data/eleventyComputed.js'

// Acceptance example: metadata fields merge into tags and categories
const sampleData = {
  tags: ['pierre-paulin', 'design-legacy'],
  analytic_lens: ['narrative-engineering', 'institutional-gatekeeping'],
  memory_ref: ['estate-law', 'brand-management'],
  spark_type: 'analytic-report',
}

test('merges tag-like metadata into unified tags and categories', () => {
  const tags = computed.tags(sampleData)
  const categories = computed.categories(sampleData)
  assert.deepStrictEqual(
    tags.sort(),
    [
      'pierre-paulin',
      'design-legacy',
      'narrative-engineering',
      'institutional-gatekeeping',
      'estate-law',
      'brand-management',
      'analytic-report',
    ].sort()
  )
  assert.deepStrictEqual(categories, ['analytic-report'])
})

// Property: tags are unique
const duplicateData = {
  tags: ['a'],
  analytic_lens: ['a', 'b'],
  memory_ref: ['b'],
  spark_type: 'a',
}

test('deduplicates tag values', () => {
  const tags = computed.tags(duplicateData)
  assert.deepStrictEqual(tags.sort(), ['a', 'b'])
})

// Contract: categories fall back to empty array

test('categories returns empty array when spark_type absent', () => {
  const categories = computed.categories({})
  assert.deepStrictEqual(categories, [])
})
