import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, MessageSquare, MoreHorizontal, Edit3, Archive, Loader2, Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Panel, PanelHeader } from '../../common/Panel';

/**
 * ChatSidebar — session list for the Workspace Chat page.
 *
 * Sprint 6 Commit 2: fully wired. Parent owns the chat list + selection
 * state and passes handlers down; the sidebar renders and calls back.
 * That keeps this component free of API calls — WorkspaceChatPage owns
 * the fetches so a single component can also react to selection changes.
 *
 * Props:
 *   chats           — array from GET /workspace/:projectId/chats
 *   activeId        — currently-selected chat id
 *   loading         — initial fetch in progress
 *   creating        — create-chat request in flight (disables + New Chat)
 *   onSelect(id)
 *   onNewChat()             → Promise
 *   onRename(id, newTitle)  → Promise
 *   onArchive(id)           → Promise
 */
const ChatSidebar = ({
  chats = [],
  activeId,
  loading = false,
  creating = false,
  onSelect,
  onNewChat,
  onRename,
  onArchive,
}) => (
  <Panel className="h-full">
    <PanelHeader
      icon={MessageSquare}
      label={`chats · ${chats.length}`}
      action={
        <button
          type="button"
          onClick={() => !creating && onNewChat && onNewChat()}
          disabled={creating}
          className="btn-accent flex items-center gap-1.5 px-2 py-0.5 text-2xs"
          title="Create a new chat"
        >
          {creating ? (
            <>
              <Loader2 size={9} className="animate-spin" /> …
            </>
          ) : (
            <>
              <Plus size={9} /> New
            </>
          )}
        </button>
      }
    />
    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
      {loading ? (
        <SidebarSkeleton />
      ) : chats.length === 0 ? (
        <SidebarEmpty onNewChat={onNewChat} creating={creating} />
      ) : (
        chats.map((chat) => (
          <ChatRow
            key={chat._id}
            chat={chat}
            active={chat._id === activeId}
            onSelect={() => onSelect && onSelect(chat._id)}
            onRename={(next) => onRename && onRename(chat._id, next)}
            onArchive={() => onArchive && onArchive(chat._id)}
          />
        ))
      )}
    </div>
  </Panel>
);

// ── Row ─────────────────────────────────────────────────────────────────────

const ChatRow = ({ chat, active, onSelect, onRename, onArchive }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(chat.title || '');
      // Defer to let the input mount before selecting.
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [editing, chat.title]);

  // Close the three-dot menu on outside click.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const beginRename = () => {
    setMenuOpen(false);
    setEditing(true);
  };

  const commitRename = async () => {
    const next = draft.trim();
    if (!next) {
      toast.error('Title cannot be empty.');
      return;
    }
    if (next === chat.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(next);
      setEditing(false);
    } catch (err) {
      toast.error(err?.message || 'Rename failed.');
    } finally {
      setSaving(false);
    }
  };

  const cancelRename = () => {
    setEditing(false);
    setDraft(chat.title || '');
  };

  const handleArchive = async () => {
    setMenuOpen(false);
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Archive "${chat.title}"?`)) return;
    try {
      await onArchive();
    } catch (err) {
      toast.error(err?.message || 'Archive failed.');
    }
  };

  // Sprint 6 Commit 3 — prefer real message activity timestamp so rows
  // reflect "when was this chat last active?" rather than "when was the
  // doc last touched?" (which could be a rename).
  const when = chat.lastMessageAt || chat.updatedAt || chat.createdAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div
        onClick={() => !editing && onSelect && onSelect()}
        className="flex items-start gap-2 px-2.5 py-2 transition-colors"
        style={{
          background: active ? '#161B22' : 'transparent',
          border: `1px solid ${active ? '#484F58' : 'transparent'}`,
          borderRadius: 6,
          cursor: editing ? 'text' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!active && !editing) e.currentTarget.style.background = '#0D1117';
        }}
        onMouseLeave={(e) => {
          if (!active && !editing) e.currentTarget.style.background = 'transparent';
        }}
        role="button"
        tabIndex={editing ? -1 : 0}
      >
        <MessageSquare
          size={11}
          style={{
            color: active ? '#58A6FF' : '#6B7280',
            marginTop: 3,
            flexShrink: 0,
          }}
        />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={100}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                }}
                onBlur={() => { if (!saving) commitRename(); }}
                onClick={(e) => e.stopPropagation()}
                className="input-field"
                style={{ padding: '2px 6px', fontSize: 12, height: 24 }}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); commitRename(); }}
                disabled={saving}
                aria-label="Save"
                style={{
                  padding: 2, background: 'transparent',
                  border: 'none', color: '#3FB950', cursor: 'pointer',
                }}
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={11} />}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cancelRename(); }}
                aria-label="Cancel"
                style={{
                  padding: 2, background: 'transparent',
                  border: 'none', color: '#F85149', cursor: 'pointer',
                }}
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <div className="text-xs truncate" style={{ color: active ? '#F0F6FC' : '#F0F6FC' }}>
                {chat.title || 'Untitled'}
              </div>
              <div className="font-mono text-2xs mt-0.5" style={{ color: '#6B7280' }}>
                {when ? formatDistanceToNow(new Date(when), { addSuffix: true }) : '—'}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Chat actions"
              className="opacity-60 hover:opacity-100 transition-opacity"
              style={{
                padding: 2, background: 'transparent',
                border: 'none', color: '#9CA3AF', cursor: 'pointer',
              }}
            >
              <MoreHorizontal size={12} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-1"
                style={{
                  minWidth: 140,
                  background: '#1C2128',
                  border: '1px solid #30363D',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(1,4,9,0.6)',
                  zIndex: 30,
                }}
              >
                <MenuItem onClick={beginRename} icon={Edit3} label="Rename" />
                <MenuItem onClick={handleArchive} icon={Archive} label="Archive" danger />
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 w-full px-2.5 py-1.5 text-2xs text-left transition-colors"
    style={{
      background: 'transparent',
      border: 'none',
      color: danger ? '#F85149' : '#F0F6FC',
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = '#21262D'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <Icon size={10} /> {label}
  </button>
);

// ── Sub-states ─────────────────────────────────────────────────────────────

const SidebarSkeleton = () => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        className="px-2.5 py-2"
        style={{
          background: '#0D1117',
          border: '1px solid #21262D',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            height: 8,
            width: `${60 - i * 6}%`,
            background: '#21262D',
            borderRadius: 3,
            marginBottom: 6,
          }}
        />
        <div
          style={{
            height: 6,
            width: '35%',
            background: '#21262D',
            borderRadius: 3,
          }}
        />
      </div>
    ))}
  </>
);

const SidebarEmpty = ({ onNewChat, creating }) => (
  <div className="flex flex-col items-center text-center px-3 py-6">
    <MessageSquare size={18} style={{ color: '#484F58' }} className="mb-2" />
    <p className="text-xs font-medium mb-1" style={{ color: '#F0F6FC' }}>
      No conversations yet
    </p>
    <p className="text-2xs leading-relaxed mb-3" style={{ color: '#6B7280' }}>
      Create your first workspace chat.
    </p>
    <button
      type="button"
      onClick={() => !creating && onNewChat && onNewChat()}
      disabled={creating}
      className="btn-accent flex items-center gap-1.5 px-2.5 py-1 text-2xs"
    >
      {creating ? (
        <>
          <Loader2 size={9} className="animate-spin" /> Creating…
        </>
      ) : (
        <>
          <Plus size={9} /> New Chat
        </>
      )}
    </button>
  </div>
);

export default ChatSidebar;
