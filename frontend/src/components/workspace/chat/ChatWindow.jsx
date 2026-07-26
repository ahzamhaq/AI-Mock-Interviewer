import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelHeader } from '../../common/Panel';
import {
  MessageSquare, Sparkles, AlertTriangle, RefreshCw, ArrowDown,
} from 'lucide-react';
import ChatMessage from './ChatMessage';
import EmptyChat from './EmptyChat';
import ConversationSkeleton from './ConversationSkeleton';

/**
 * ChatWindow — main conversation surface.
 *
 * Sprint 6 Commit 6:
 *   • Smart auto-scroll: only follows the newest message when the user
 *     is already near the bottom. If they've scrolled up to re-read
 *     something, we leave them alone.
 *   • Jump-to-latest button appears when the user is scrolled away.
 *   • Better typing indicator (animated dots + "Generating response…"
 *     copy, appears in-place where the assistant reply will render).
 *   • Regenerate handler wired through only for the LAST assistant
 *     message so mid-history bubbles don't offer an action the
 *     backend won't honor.
 *
 * State matrix:
 *   • no chat selected       → EmptyChat marketing state
 *   • chat + loading         → ConversationSkeleton
 *   • chat + error           → retry surface
 *   • chat + zero messages   → SuggestedPrompts hint
 *   • chat + messages        → ChatMessage list + auto-scroll
 *
 * Props:
 *   activeChat      — selected WorkspaceChat record (or null)
 *   messages        — WorkspaceMessage[]
 *   loading         — initial messages fetch in flight
 *   error           — error string from the last fetch (or null)
 *   sending         — user just hit send; append typing hint
 *   onRetry         — retry the messages fetch
 *   onRegenerate    — (messageId) => void, offered to the last assistant
 *   regeneratingId  — id currently regenerating (or null)
 *   onSuggestPrompt — (prompt) => void, empty-state suggestion clicked
 *                     inside a selected chat
 *   onQuickStart    — (prompt) => void, EmptyChat capability clicked
 *                     when no chat is selected. Parent should create a
 *                     new chat then send the prompt.
 */
const NEAR_BOTTOM_PX = 80;

const SUGGESTED_PROMPTS = [
  'Explain the project architecture.',
  'How is authentication implemented?',
  'What technologies are used in this project?',
  'Explain the folder structure.',
  'Generate interview questions from this codebase.',
];

const ChatWindow = ({
  activeChat = null,
  messages = [],
  loading = false,
  error = null,
  sending = false,
  onRetry,
  onRegenerate,
  regeneratingId = null,
  onSuggestPrompt,
  onQuickStart,
}) => {
  const scrollerRef = useRef(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  const isNearBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    return remaining <= NEAR_BOTTOM_PX;
  }, []);

  const handleScroll = useCallback(() => {
    const near = isNearBottom();
    setPinnedToBottom(near);
    if (near) setHasNewBelow(false);
  }, [isNearBottom]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setPinnedToBottom(true);
    setHasNewBelow(false);
  }, []);

  // Reset scroll state to bottom when the active chat changes.
  useEffect(() => {
    if (activeChat?._id) {
      // Defer to let the new message list render first.
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [activeChat?._id, scrollToBottom]);

  // Auto-scroll on new messages ONLY when the user is at the bottom.
  // Otherwise flag "new content below" so the jump-to-latest chip lights.
  useEffect(() => {
    if (!scrollerRef.current) return;
    if (pinnedToBottom) {
      scrollToBottom(true);
    } else {
      setHasNewBelow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, sending]);

  // Identify the last assistant message id so we only offer Regenerate
  // on the newest reply (matches the backend constraint).
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i]._id || messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={MessageSquare}
        label={activeChat?.title || 'no chat selected'}
      />
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="overflow-y-auto p-4"
          style={{ height: '100%' }}
        >
          {!activeChat ? (
            <EmptyChat onQuickStart={onQuickStart} />
          ) : loading ? (
            <ConversationSkeleton />
          ) : error ? (
            <ConversationError error={error} onRetry={onRetry} />
          ) : messages.length === 0 ? (
            <SuggestedPromptsHint onSuggestPrompt={onSuggestPrompt} />
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => {
                const id = m._id || m.id;
                const isLastAssistant = id === lastAssistantId;
                return (
                  <ChatMessage
                    key={id || `${m.role}-${m.createdAt}`}
                    role={m.role}
                    content={m.content}
                    createdAt={m.createdAt}
                    onRegenerate={
                      m.role === 'assistant' && isLastAssistant && onRegenerate
                        ? () => onRegenerate(id)
                        : undefined
                    }
                    regenerating={regeneratingId != null && regeneratingId === id}
                  />
                );
              })}
              {sending && <AssistantTypingHint />}
            </div>
          )}
        </div>

        {/* Floating "jump to latest" chip when the user scrolled up
            and new content arrived. */}
        {activeChat && !loading && !error && messages.length > 0 && !pinnedToBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            aria-label="Jump to latest message"
            className="absolute inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-2xs shadow-lg"
            style={{
              bottom: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1C2128',
              border: '1px solid #30363D',
              borderRadius: 999,
              color: hasNewBelow ? '#58A6FF' : '#9CA3AF',
              cursor: 'pointer',
            }}
          >
            <ArrowDown size={11} />
            {hasNewBelow ? 'New reply · Jump to latest' : 'Jump to latest'}
          </button>
        )}
      </div>
    </Panel>
  );
};

const SuggestedPromptsHint = ({ onSuggestPrompt }) => (
  <div className="flex flex-col items-center text-center h-full justify-center py-10 px-4">
    <div
      className="flex items-center justify-center mb-4"
      style={{
        width: 40, height: 40,
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 10,
      }}
    >
      <Sparkles size={16} style={{ color: '#58A6FF' }} />
    </div>
    <p className="text-sm font-semibold mb-1" style={{ color: '#F0F6FC' }}>
      Start a conversation
    </p>
    <p className="text-xs leading-relaxed max-w-sm mb-4" style={{ color: '#9CA3AF' }}>
      Ask anything about this project — architecture, key files, or how
      a specific piece works. Answers are grounded in this repository&apos;s
      analysis.
    </p>
    {onSuggestPrompt && (
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSuggestPrompt(p)}
            className="text-left px-3 py-2 text-xs transition-colors"
            style={{
              background: '#0D1117',
              border: '1px solid #30363D',
              borderRadius: 6,
              color: '#F0F6FC',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#161B22'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0D1117'; }}
          >
            {p}
          </button>
        ))}
      </div>
    )}
  </div>
);

const ConversationError = ({ error, onRetry }) => (
  <div className="flex flex-col items-center text-center h-full justify-center py-10 px-4">
    <div
      className="flex items-center justify-center mb-3"
      style={{
        width: 40, height: 40,
        background: 'rgba(248,81,73,0.08)',
        border: '1px solid rgba(248,81,73,0.3)',
        borderRadius: 10,
      }}
    >
      <AlertTriangle size={16} style={{ color: '#F85149' }} />
    </div>
    <p className="text-sm font-semibold mb-1" style={{ color: '#F0F6FC' }}>
      Couldn&apos;t load this conversation
    </p>
    <p className="text-xs leading-relaxed max-w-sm mb-3" style={{ color: '#9CA3AF' }}>
      {error || 'Something went wrong reading messages.'}
    </p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
      >
        <RefreshCw size={11} /> Retry
      </button>
    )}
  </div>
);

const AssistantTypingHint = () => (
  <div className="flex items-center gap-2 pl-8">
    <div className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: '#58A6FF',
            display: 'inline-block',
            animation: `chatDot 1s ${i * 0.15}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
    <span className="font-mono text-2xs" style={{ color: '#9CA3AF' }}>
      Generating response…
    </span>
    <style>{`
      @keyframes chatDot {
        0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
        40%           { opacity: 1;   transform: translateY(-3px); }
      }
    `}</style>
  </div>
);

export default ChatWindow;
