import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, Lock, Star, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * ProjectCard — real project card rendered in the Projects list and on the
 * Dashboard "Recent Projects" panel. Visual language matches the existing
 * card-hover pattern (Panel + #30363D border, brightens on hover). No
 * gradients, no glassmorphism — consistent with the rest of the app.
 *
 * The card is clickable and routes to the Workspace. When the project's
 * latest analysis is still processing, we show a small loader in place of
 * the language chip so users understand why the Workspace may be sparse.
 *
 * Props:
 *   project – shape from projectsAPI.list()
 *              { _id, repoOwner, repoName, metadata: { language, stars, private, description },
 *                analysisStatus: 'processing' | 'ready' | 'failed' | null, updatedAt }
 */
const ProjectCard = ({ project }) => {
  const navigate = useNavigate();
  const status = project.analysisStatus;
  const processing = status === 'processing';
  const failed = status === 'failed';

  const openWorkspace = () => {
    if (processing) {
      navigate(`/projects/${project._id}/analyzing`);
    } else {
      navigate(`/projects/${project._id}`);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={openWorkspace}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-col items-start text-left w-full h-full p-4 transition-colors"
      style={{
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 6,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#161B22';
        e.currentTarget.style.borderColor = '#484F58';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#0D1117';
        e.currentTarget.style.borderColor = '#30363D';
      }}
    >
      <div className="flex items-start justify-between w-full mb-2">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 28,
            height: 28,
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 6,
          }}
        >
          <GitBranch size={13} style={{ color: '#58A6FF' }} />
        </div>
        {project.metadata?.private && (
          <Lock size={11} style={{ color: '#6B7280' }} aria-label="Private repository" />
        )}
      </div>

      <div
        className="font-mono text-2xs uppercase tracking-wide mb-1 truncate max-w-full"
        style={{ color: '#6B7280' }}
      >
        {project.repoOwner}
      </div>

      <div
        className="text-sm font-semibold mb-1 truncate max-w-full"
        style={{ color: '#F0F6FC' }}
      >
        {project.repoName}
      </div>

      {project.metadata?.description && (
        <p
          className="text-xs leading-relaxed mb-3 line-clamp-2"
          style={{ color: '#9CA3AF', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {project.metadata.description}
        </p>
      )}

      <div className="flex items-center gap-2 font-mono text-2xs mt-auto pt-2 w-full" style={{ color: '#6B7280' }}>
        {processing ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5"
            style={{
              color: '#D29922',
              background: 'rgba(210,153,34,0.1)',
              border: '1px solid rgba(210,153,34,0.3)',
              borderRadius: 3,
            }}
          >
            <Loader2 size={9} className="animate-spin" /> analyzing
          </span>
        ) : failed ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5"
            style={{
              color: '#F85149',
              background: 'rgba(248,81,73,0.1)',
              border: '1px solid rgba(248,81,73,0.3)',
              borderRadius: 3,
            }}
          >
            failed
          </span>
        ) : project.metadata?.language ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5"
            style={{
              background: '#161B22',
              border: '1px solid #30363D',
              borderRadius: 3,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#58A6FF' }}
            />
            {project.metadata.language}
          </span>
        ) : null}

        {typeof project.metadata?.stars === 'number' && project.metadata.stars > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star size={9} /> {project.metadata.stars}
          </span>
        )}

        {project.updatedAt && (
          <span className="ml-auto truncate">
            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
          </span>
        )}
      </div>
    </motion.button>
  );
};

export default ProjectCard;
