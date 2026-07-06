const mongoose = require('mongoose');

/**
 * Project — the Workspace. A Project is the central Sprint-2 entity: every
 * Workspace-scoped feature (analysis, project interviews, and future modules
 * like Chat/Health/Diagram) hangs off a Project.
 *
 * A Project can be created from two sources — a pasted public URL, or a
 * repository picked from a connected GitHub account. Both paths produce the
 * same document shape; `source` records which flow was used.
 *
 * The Project itself holds only stable identity + metadata. The heavy,
 * re-runnable output (summary, tech stack, key files, architecture) lives in
 * a separate RepositoryAnalysis document referenced by `latestAnalysisId`.
 * This lets us re-analyze without mutating the Project record and keeps
 * historical analyses discoverable if we want to expose them later.
 */
const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // How this project entered the platform. Reserved for future providers.
  source: {
    type: String,
    enum: ['public_url', 'github_connected'],
    required: true,
  },
  provider: {
    type: String,
    enum: ['github'],
    default: 'github',
  },

  // Repository identity — kept as owner+name so re-fetches don't depend on
  // the exact URL variant the user pasted.
  repoOwner: { type: String, required: true, trim: true },
  repoName:  { type: String, required: true, trim: true },
  repoUrl:   { type: String, required: true, trim: true },
  defaultBranch: { type: String, default: 'main' },

  // Snapshot of GitHub metadata at connect time. Cheap to keep, avoids an
  // extra API call every time the Workspace is opened.
  metadata: {
    description: { type: String, default: '' },
    language:    { type: String, default: '' },
    stars:       { type: Number, default: 0 },
    forks:       { type: Number, default: 0 },
    htmlUrl:     { type: String, default: '' },
    homepage:    { type: String, default: '' },
    private:     { type: Boolean, default: false },
    updatedAt:   { type: Date, default: null },
  },

  latestAnalysisId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RepositoryAnalysis',
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// One project per (user, repo). Users can still track the same repo across
// accounts; the same user can't accidentally create duplicates.
projectSchema.index({ userId: 1, repoOwner: 1, repoName: 1 }, { unique: true });

// Convenience virtual so callers can render "owner/repo" without joining.
projectSchema.virtual('fullName').get(function () {
  return `${this.repoOwner}/${this.repoName}`;
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
