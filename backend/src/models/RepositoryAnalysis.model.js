const mongoose = require('mongoose');

/**
 * RepositoryAnalysis — the output of the analysis pipeline for one Project.
 *
 * Kept in its own collection (not embedded on Project) for three reasons:
 *   1. Analyses are re-runnable. Storing them separately preserves history
 *      and lets us swap `Project.latestAnalysisId` atomically.
 *   2. The document can be large (summaries, file lists) — pulling a
 *      Project list should not drag full analyses along.
 *   3. Status transitions (processing → ready | failed) are easier to reason
 *      about on a dedicated record than as a mutable sub-doc.
 *
 * All content fields are populated by the LLM step. The pipeline enforces the
 * 40-file / 150-KB budget before the LLM is called — `filesRead` and
 * `bytesRead` record what actually made it into the prompt.
 */
const repositoryAnalysisSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },

  // Lifecycle. `processing` is the initial state written before the LLM call;
  // the frontend polls until it flips to `ready` or `failed`.
  status: {
    type: String,
    enum: ['processing', 'ready', 'failed'],
    default: 'processing',
    index: true,
  },
  error: { type: String, default: null },

  // Core content — the four fields Sprint 2 promises on the Workspace Overview.
  summary:             { type: String, default: '' },
  architectureSummary: { type: String, default: '' },

  // Tech stack detected from manifests + file signals. `category` lets the UI
  // group (e.g. "frameworks", "runtime", "testing"). `confidence` is the LLM's
  // self-reported certainty on a 0–1 scale.
  techStack: {
    type: [{
      name:       { type: String, required: true },
      category:   {
        type: String,
        enum: ['language', 'framework', 'runtime', 'database', 'testing', 'build', 'deploy', 'other'],
        default: 'other',
      },
      confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    }],
    default: [],
  },

  // Key files that shaped the analysis. `purpose` is the short LLM-provided
  // reason (e.g. "app entry point"). Capped to 40 by the pipeline.
  importantFiles: {
    type: [{
      path:    { type: String, required: true },
      purpose: { type: String, default: '' },
      size:    { type: Number, default: 0 },
    }],
    default: [],
  },

  // Provenance — helpful for debugging and future eval work.
  filesRead: { type: Number, default: 0 },
  bytesRead: { type: Number, default: 0 },
  model:     { type: String, default: '' },
}, {
  timestamps: true,
});

const RepositoryAnalysis = mongoose.model('RepositoryAnalysis', repositoryAnalysisSchema);
module.exports = RepositoryAnalysis;
