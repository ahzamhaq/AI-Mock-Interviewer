// Lightweight, deterministic, hash-based embedding + cosine similarity.
// Lets us de-duplicate questions semantically without calling an embedding API.
// Good enough to catch obvious rephrasing; for production-grade dedup,
// swap simpleEmbed for a real embedding model and store in a vector DB.

function simpleEmbed(text, dims = 64) {
  const words = String(text || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const vec = new Array(dims).fill(0);
  for (const w of words) {
    let h = 5381;
    for (let i = 0; i < w.length; i++) h = ((h << 5) + h) ^ w.charCodeAt(i);
    vec[Math.abs(h) % dims] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports = { simpleEmbed, cosineSimilarity };
