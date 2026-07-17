import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Clock, ArrowRight } from 'lucide-react';

/**
 * TemplateCard — one built-in interview template on the Interview Hub.
 *
 * Reuses the same visual language as InterviewHubCard and SetupMethodCard
 * so the Hub feels cohesive: same #0D1117 bg, #30363D border, hover
 * pattern, uppercase mono CTA label.
 *
 * Props:
 *   template — entry from data/interviewTemplates.js
 *   onClick  — click handler; parent decides where to route
 */
const TemplateCard = ({ template, onClick }) => {
  const Icon = Icons[template.icon] || Icons.Layers;
  const estMinutes = Math.max(5, Math.round((template.payload?.totalQuestions || 5) * 5));

  return (
    <motion.button
      type="button"
      onClick={onClick}
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
          <Icon size={13} style={{ color: '#58A6FF' }} />
        </div>
        <span
          className="inline-flex items-center gap-1 font-mono text-2xs"
          style={{ color: '#6B7280' }}
        >
          <Clock size={9} /> {estMinutes}m
        </span>
      </div>

      <h3 className="text-sm font-semibold mb-1" style={{ color: '#F0F6FC' }}>
        {template.name}
      </h3>
      <p
        className="text-xs leading-relaxed mb-3"
        style={{
          color: '#9CA3AF',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {template.description}
      </p>

      {template.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.topics.slice(0, 4).map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-1.5 py-0.5 font-mono text-2xs"
              style={{
                color: '#9CA3AF',
                background: '#161B22',
                border: '1px solid #30363D',
                borderRadius: 3,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="w-full mt-auto flex items-center justify-between">
        <span
          className="font-mono text-2xs uppercase tracking-wide"
          style={{ color: '#58A6FF' }}
        >
          Use Template
        </span>
        <ArrowRight size={11} style={{ color: '#58A6FF' }} />
      </div>
    </motion.button>
  );
};

export default TemplateCard;
