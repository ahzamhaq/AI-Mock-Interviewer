import React from 'react';

/**
 * ConversationSkeleton — placeholder blocks that mimic the ChatMessage
 * layout so the conversation area doesn't collapse or flash while the
 * initial GET /messages request is in flight.
 *
 * Alternates left / right blocks to preview the assistant / user
 * rhythm. Purely presentational.
 */
const ConversationSkeleton = () => (
  <div className="flex flex-col gap-3">
    {[
      { align: 'left',  w: '62%' },
      { align: 'right', w: '40%' },
      { align: 'left',  w: '78%' },
      { align: 'right', w: '30%' },
    ].map((row, i) => (
      <div
        key={i}
        className="flex items-start gap-2"
        style={{ flexDirection: row.align === 'right' ? 'row-reverse' : 'row' }}
      >
        <div
          className="flex-shrink-0"
          style={{
            width: 26,
            height: 26,
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: 6,
          }}
        />
        <div
          className="px-3 py-2"
          style={{
            width: row.w,
            maxWidth: '78%',
            background: '#0D1117',
            border: '1px solid #30363D',
            borderRadius: 6,
          }}
        >
          <div style={{ height: 7, width: '35%', background: '#21262D', borderRadius: 3, marginBottom: 6 }} />
          <div style={{ height: 6, width: '92%', background: '#21262D', borderRadius: 3, marginBottom: 4 }} />
          <div style={{ height: 6, width: '68%', background: '#21262D', borderRadius: 3 }} />
        </div>
      </div>
    ))}
  </div>
);

export default ConversationSkeleton;
