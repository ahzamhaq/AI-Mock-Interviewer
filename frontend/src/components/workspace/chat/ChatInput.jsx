import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SendHorizonal, Loader2 } from 'lucide-react';

/**
 * ChatInput — controlled auto-resizing textarea + send.
 *
 * Sprint 6 Commit 6 polish:
 *   • Auto-resize between MIN_HEIGHT and MAX_HEIGHT.
 *   • Enter → send · Shift+Enter → newline · IME-safe (isComposing).
 *   • sending prop disables + shows spinner inside the send button.
 *   • disabled prop hard-disables (no chat selected).
 *   • Char counter turns amber past 90%.
 *   • Preserves focus after successful send.
 *   • On send failure, parent pushes `restoreValue` so typed text is
 *     never silently lost; we accept it and re-focus.
 *   • forwardRef exposes `focus()` so the parent can pull focus after
 *     a suggested-prompt click.
 *
 * Props:
 *   onSend(content) → Promise
 *   sending         — request in flight
 *   disabled        — no chat selected
 *   maxLength       — enforced client-side (default 4000, matches backend)
 *   restoreValue    — string to populate on failure; consumed once per change
 */
const DEFAULT_MAX = 4000;
const MIN_HEIGHT = 44;
const MAX_HEIGHT = 200;

const ChatInput = React.forwardRef(({
  onSend,
  sending = false,
  disabled = false,
  maxLength = DEFAULT_MAX,
  restoreValue = '',
}, ref) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const lastRestoreRef = useRef('');

  // Expose focus() to the parent so suggested-prompt buttons can pull
  // focus after populating the input.
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Restore typed text after a failed send.
  useEffect(() => {
    if (restoreValue && restoreValue !== lastRestoreRef.current) {
      lastRestoreRef.current = restoreValue;
      setValue(restoreValue);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [restoreValue]);

  // Auto-resize any time the value changes.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [value]);

  const submit = async () => {
    if (sending || disabled) return;
    const clean = value.trim();
    if (!clean) return;
    setValue('');
    try {
      await onSend(clean);
      // Preserve focus so a user can immediately type a follow-up.
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      // Parent restores via restoreValue.
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const isDisabled = disabled || sending;
  const placeholder = disabled
    ? 'Select a chat to start typing…'
    : sending
      ? 'Generating response…'
      : 'Ask anything about this project — Enter to send · Shift+Enter for a new line';

  const nearLimit = value.length > maxLength * 0.9;
  const overLimit = value.length >= maxLength;

  return (
    <div
      className="p-3"
      style={{
        background: '#161B22',
        border: '1px solid #30363D',
        borderRadius: 6,
      }}
    >
      <div className="flex items-end gap-2">
        <label htmlFor="chat-input-textarea" className="sr-only">
          Type a message
        </label>
        <textarea
          id="chat-input-textarea"
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={maxLength}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isDisabled}
          placeholder={placeholder}
          className="input-field"
          aria-label="Chat message"
          style={{
            resize: 'none',
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
            background: '#0D1117',
            color: isDisabled ? '#6B7280' : '#F0F6FC',
            cursor: isDisabled ? 'not-allowed' : 'text',
            lineHeight: 1.5,
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={isDisabled || !value.trim()}
          className="btn-accent flex items-center gap-1.5 px-3 py-2 text-xs"
          style={{ height: MIN_HEIGHT }}
          aria-label={sending ? 'Sending message' : 'Send message'}
          title={sending ? 'Generating response…' : 'Send (Enter)'}
        >
          {sending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <SendHorizonal size={12} />
          )}
        </button>
      </div>
      <div
        className="flex items-center justify-between mt-2 font-mono text-2xs"
        style={{ color: '#484F58' }}
      >
        <span>
          {disabled
            ? '// select a chat above'
            : '// enter sends · shift+enter for newline'}
        </span>
        <span
          style={{
            color: overLimit ? '#F85149' : nearLimit ? '#D29922' : '#484F58',
          }}
          aria-live="polite"
        >
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
