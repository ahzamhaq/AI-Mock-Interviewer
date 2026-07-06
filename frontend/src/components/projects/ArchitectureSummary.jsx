import React from 'react';

/**
 * ArchitectureSummary — plain prose block for the LLM-produced architecture
 * summary. Deliberately unstyled beyond typography so the model's output
 * reads as-is; formatting decisions belong in the prompt, not the UI.
 */
const ArchitectureSummary = ({ text }) => {
  if (!text) {
    return (
      <p className="text-xs" style={{ color: '#6B7280' }}>
        No architecture summary was produced for this repository.
      </p>
    );
  }
  return (
    <p
      className="text-xs leading-relaxed whitespace-pre-line"
      style={{ color: '#F0F6FC' }}
    >
      {text}
    </p>
  );
};

export default ArchitectureSummary;
