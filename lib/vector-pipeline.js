/**
 * Vector Embedding Pipeline — Semantic content vectorization for LanceDB vault
 * Converts lens results and AST annotations into dense embeddings for
 * similarity search, clustering, and anomaly detection across the knowledge base.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class VectorPipeline {
  constructor(opts = {}) {
    this.model = opts.model || process.env.VECTOR_MODEL || 'fastembed';
    this.dimension = opts.dimension || parseInt(process.env.VECTOR_DIM || '384', 10);
    this.batchSize = opts.batchSize || parseInt(process.env.VECTOR_BATCH_SIZE || '32', 10);
    this.vaultPath = opts.vaultPath || process.env.OPHEL_VAULT_PATH || '/tmp/ophel-vault';
    this.cache = new Map();
  }

  async embed(text) {
    if (this.cache.has(text)) return this.cache.get(text);
    // FastEmbed via Python subprocess (Bun-compatible)
    const py = spawn('python3', ['-c', `
import sys, json
try:
    from fastembed import TextEmbedding
    model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    text = sys.argv[1]
    emb = list(model.embed([text]))[0]
    print(json.dumps(emb.tolist()))
except Exception as e:
    print(json.dumps([0.0]*384))
`, text], { timeout: 10000 });

    let output = '';
    py.stdout.on('data', d => output += d);

    return new Promise((resolve, reject) => {
      py.on('close', code => {
        try {
          const vec = JSON.parse(output.trim());
          this.cache.set(text, vec);
          resolve(vec);
        } catch {
          resolve(new Array(this.dimension).fill(0.0));
        }
      });
      py.on('error', () => resolve(new Array(this.dimension).fill(0.0)));
    });
  }

  async embedBatch(texts) {
    const chunks = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      chunks.push(texts.slice(i, i + this.batchSize));
    }
    const results = [];
    for (const chunk of chunks) {
      const vecs = await Promise.all(chunk.map(t => this.embed(t)));
      results.push(...vecs);
    }
    return results;
  }

  async indexLensResults(lensResults, meta = {}) {
    const docs = [];
    for (const [lensName, result] of Object.entries(lensResults)) {
      const text = JSON.stringify(result);
      const vec = await this.embed(text);
      docs.push({
        id: `${meta.path || 'unknown'}:${lensName}:${Date.now()}`,
        vector: vec,
        text: text.slice(0, 2000),
        lens: lensName,
        source: meta.path,
        timestamp: new Date().toISOString(),
        metadata: { ...meta, lensName }
      });
    }
    return docs;
  }

  async indexASTAnnotations(annotations, meta = {}) {
    const docs = [];
    for (const ann of annotations) {
      const text = JSON.stringify(ann.lensResults || ann);
      const vec = await this.embed(text);
      docs.push({
        id: `ast:${ann.nodeId || 'unknown'}:${Date.now()}`,
        vector: vec,
        text: text.slice(0, 2000),
        nodeType: ann.type,
        source: meta.path,
        timestamp: new Date().toISOString(),
        metadata: { ...meta, nodeType: ann.type, position: ann.position }
      });
    }
    return docs;
  }

  async similaritySearch(query, docs, topK = 5) {
    const qVec = await this.embed(query);
    const scored = docs.map(doc => ({
      ...doc,
      score: cosineSimilarity(qVec, doc.vector)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

module.exports = { VectorPipeline, cosineSimilarity };