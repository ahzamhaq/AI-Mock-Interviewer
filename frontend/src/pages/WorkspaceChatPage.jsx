import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  GitBranch, Loader2, ArrowLeft, AlertTriangle, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/layout/Navbar';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import ChatSidebar from '../components/workspace/chat/ChatSidebar';
import ChatWindow from '../components/workspace/chat/ChatWindow';
import ChatInput from '../components/workspace/chat/ChatInput';
import WorkspaceTabs from '../components/projects/WorkspaceTabs';
import { projectsAPI } from '../services/api';
import * as workspaceChat from '../services/workspaceChat';
import { getWorkspaceContext } from '../services/workspaceContext';
import { deriveChatTitle } from '../components/workspace/chat/markdownUtils';

/**
 * WorkspaceChatPage — repository-aware AI chat surface (Sprint 6).
 *
 * Owns end-to-end state:
 *   • project fetch (Commit 1)
 *   • chat list + CRUD (Commit 2)
 *   • message load + send (Commit 3)
 *
 * The assistant reply today is a static placeholder generated server-
 * side; Commit 4 will swap it for a real AI-backed response. The full
 * pipeline (POST → persist both messages → update chat preview →
 * refetch chat list order → render + auto-scroll) is verifiable
 * without any LLM involvement.
 *
 * State is deliberately local. No global store; a single page owns the
 * chat session + message model and passes both down to child components.
 */
const WorkspaceChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState(null);

  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [chatsError, setChatsError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);

  // Messages — reset any time the active chat changes.
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [sending, setSending] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [regeneratingId, setRegeneratingId] = useState(null);

  // Ref into ChatInput so suggested-prompt clicks can pull focus.
  const chatInputRef = useRef(null);

  // Repository context (Sprint 6 Commit 4). Loaded once per project.
  // Commit 5's prompt builder consumes this; Commit 4 just caches it in
  // page state and swallows fetch failures with a toast so the chat
  // remains usable even if the context service errors out.
  // eslint-disable-next-line no-unused-vars
  const [context, setContext] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [contextLoading, setContextLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [contextError, setContextError] = useState(null);

  // ── Project ────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    projectsAPI.getById(id)
      .then((res) => {
        if (!alive) return;
        setProject(res.project);
        setAnalysis(res.analysis);
      })
      .catch((err) => { if (alive) setProjectError(err.message); })
      .finally(() => { if (alive) setProjectLoading(false); });
    return () => { alive = false; };
  }, [id]);

  // ── Repository Context (Sprint 6 Commit 4) ────────────────────────────
  // Loaded once per project. Not per message — repo state changes
  // infrequently. Commit 5's prompt builder will read this cached
  // object; today it just sits in state so the fetch is warmed up and
  // any error surface is validated end-to-end.
  //
  // Failures are non-blocking: chat continues to work with the placeholder
  // assistant. A single toast informs the user; no error banner, no
  // blocked send.
  useEffect(() => {
    let alive = true;
    setContext(null);
    setContextError(null);
    setContextLoading(true);
    getWorkspaceContext(id)
      .then((res) => {
        if (!alive) return;
        setContext(res.context || null);
      })
      .catch((err) => {
        if (!alive) return;
        const message = err?.message || 'Could not load repository context.';
        setContextError(message);
        // One-time notice — chat itself is fine, this is an enhancement
        // that has not landed yet.
        toast.error(`Repository context unavailable: ${message}`, { id: `ctx-${id}` });
      })
      .finally(() => { if (alive) setContextLoading(false); });
    return () => { alive = false; };
  }, [id]);

  // ── Chats ──────────────────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    setChatsError(null);
    try {
      const res = await workspaceChat.getChats(id);
      const list = res.chats || [];
      setChats(list);
      // Auto-select: keep the current selection if it still exists;
      // otherwise pick the newest chat; empty list means no selection.
      setActiveChatId((prev) => {
        if (prev && list.some((c) => c._id === prev)) return prev;
        return list[0]?._id || null;
      });
    } catch (err) {
      setChatsError(err.message || 'Could not load chats.');
      setChats([]);
    } finally {
      setChatsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const activeChat = chats.find((c) => c._id === activeChatId) || null;

  // ── Messages ───────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (chatId) => {
    if (!chatId) {
      setMessages([]);
      setMessagesLoading(false);
      setMessagesError(null);
      return;
    }
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const res = await workspaceChat.getMessages(chatId);
      const loaded = res.messages || [];
      setMessages(loaded);

      // Retroactive title derivation — if a legacy chat is still named
      // "New Chat" but has real user turns, derive from the first one.
      // Handles chats created before the auto-title patch landed.
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === chatId);
        if (idx === -1) return prev;
        const chat = prev[idx];
        if ((chat.title || '').trim() !== 'New Chat') return prev;
        const firstUser = loaded.find((m) => m.role === 'user' && m.content);
        if (!firstUser) return prev;
        const derived = deriveChatTitle(firstUser.content);
        if (!derived) return prev;
        // Fire-and-forget rename; local state updates immediately.
        workspaceChat.renameChat(chatId, derived).catch(() => {});
        const next = [...prev];
        next[idx] = { ...chat, title: derived };
        return next;
      });
    } catch (err) {
      setMessagesError(err.message || 'Could not load conversation.');
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    // React to selection changes only — loadChats will pre-populate
    // activeChatId, so this hook covers both auto-select and manual
    // clicks in the sidebar.
    loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleNewChat = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await workspaceChat.createChat(id);
      const chat = res.chat;
      // Optimistic-ish: prepend to sidebar and select immediately.
      setChats((prev) => [chat, ...prev.filter((c) => c._id !== chat._id)]);
      setActiveChatId(chat._id);
    } catch (err) {
      toast.error(err.message || 'Could not create chat.');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (chatId, newTitle) => {
    // Optimistic — patch the row immediately, roll back on failure.
    const prevSnapshot = chats;
    setChats((prev) => prev.map((c) => (c._id === chatId ? { ...c, title: newTitle } : c)));
    try {
      const res = await workspaceChat.renameChat(chatId, newTitle);
      setChats((prev) => prev.map((c) => (c._id === chatId ? { ...c, ...res.chat } : c)));
    } catch (err) {
      setChats(prevSnapshot);
      throw err;
    }
  };

  const handleSend = async (content) => {
    if (!activeChatId || sending) return;

    // Snapshot BEFORE the optimistic append — this tells us whether the
    // chat had any prior turns at the moment the user hit send, which
    // is what "is this the first turn?" actually means for title
    // derivation below. Reading messages.length inside the try{} block
    // would reflect the closure at callback-definition time (React 18
    // stale-closure trap) and misfire.
    const wasEmptyBeforeSend = messages.length === 0;

    // Optimistic user bubble. Temporary id so React keys are stable
    // until the server confirms; we swap it in place with the real
    // record when the response returns.
    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      chat: activeChatId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);

    try {
      const res = await workspaceChat.sendMessage(activeChatId, content);
      // Replace optimistic bubble with the server-confirmed user
      // message, then append the assistant placeholder.
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m._id !== tempId);
        const next = [...withoutTemp];
        if (res.userMessage) next.push(res.userMessage);
        if (res.assistantMessage) next.push(res.assistantMessage);
        return next;
      });

      // Chat list preview + reorder. Move the active chat to the top
      // and stamp its preview + lastMessageAt from the assistant
      // reply — mirrors the server-side sort so the sidebar reflects
      // reality without a refetch.
      const previewSource = res.assistantMessage?.content || content;
      const previewAt = res.assistantMessage?.createdAt || new Date().toISOString();
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === activeChatId);
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          lastMessagePreview: previewSource.slice(0, 100),
          lastMessage: previewSource.slice(0, 100),
          lastMessageAt: previewAt,
          updatedAt: previewAt,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });

      // Sprint 6 Commit 6: auto-derive a chat title from the first
      // user prompt when the chat still carries the default "New Chat"
      // name. Derivation is purely local — no AI call. If the user
      // manually renamed the chat we never touch it.
      const currentChat = chats.find((c) => c._id === activeChatId);
      const hadOnlyDefaultTitle = currentChat && (currentChat.title || '').trim() === 'New Chat';
      if (hadOnlyDefaultTitle && wasEmptyBeforeSend) {
        const derived = deriveChatTitle(content);
        if (derived) {
          workspaceChat.renameChat(activeChatId, derived)
            .then(() => {
              setChats((prev) => prev.map((c) => (
                c._id === activeChatId ? { ...c, title: derived } : c
              )));
            })
            .catch(() => { /* silent — title auto-derivation is a nicety */ });
        }
      }
    } catch (err) {
      // Roll back the optimistic bubble and restore the input so the
      // user's text is never lost.
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setRestoreInput(content);
      toast.error(err.message || 'Failed to send message.');
      throw err;
    } finally {
      setSending(false);
    }
  };

  const handleRegenerate = async (messageId) => {
    if (!activeChatId || regeneratingId) return;

    // Snapshot the target so we can restore it if the request fails.
    const target = messages.find((m) => (m._id || m.id) === messageId);
    if (!target) return;

    setRegeneratingId(messageId);
    // Remove the current assistant bubble optimistically so the typing
    // indicator has room to render in-place.
    setMessages((prev) => prev.filter((m) => (m._id || m.id) !== messageId));

    try {
      const res = await workspaceChat.regenerateMessage(activeChatId, messageId);
      if (res.assistantMessage) {
        setMessages((prev) => [...prev, res.assistantMessage]);
        // Sidebar preview mirror.
        const previewSource = res.assistantMessage.content || '';
        const previewAt = res.assistantMessage.createdAt || new Date().toISOString();
        setChats((prev) => prev.map((c) => (
          c._id === activeChatId
            ? {
              ...c,
              lastMessagePreview: previewSource.slice(0, 100),
              lastMessage: previewSource.slice(0, 100),
              lastMessageAt: previewAt,
              updatedAt: previewAt,
            }
            : c
        )));
        toast.success('Message regenerated');
      }
    } catch (err) {
      // Restore the original assistant message so the conversation
      // stays coherent.
      setMessages((prev) => {
        // Insert the snapshot in its original chronological place.
        const next = [...prev, target].sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
        );
        return next;
      });
      toast.error(err.message || 'Failed to regenerate response.');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSuggestPrompt = (prompt) => {
    // Populate the input, focus it, and send. Matches spec: "Clicking
    // one should populate and immediately send the prompt."
    setRestoreInput(prompt);
    // Focus so the input feels responsive even if send is fast.
    requestAnimationFrame(() => chatInputRef.current?.focus());
    // Fire the send. handleSend guards on sending state itself.
    handleSend(prompt).catch(() => { /* handled inside handleSend */ });
  };

  // Zero-click onboarding: EmptyChat capability tiles land here when no
  // chat exists. Create a fresh chat, wait for the id, then dispatch
  // the send against that id explicitly (state-set is async — we can't
  // rely on activeChatId being current inside the same tick).
  const handleQuickStart = async (prompt) => {
    if (creating || sending) return;
    setCreating(true);
    let newChat;
    try {
      const res = await workspaceChat.createChat(id);
      newChat = res.chat;
      setChats((prev) => [newChat, ...prev.filter((c) => c._id !== newChat._id)]);
      setActiveChatId(newChat._id);
    } catch (err) {
      toast.error(err.message || 'Could not create chat.');
      setCreating(false);
      return;
    }
    setCreating(false);

    // Send against the explicit chat id — handleSend uses activeChatId
    // from closure, which won't update this tick. Inline the send so
    // the newly-created chat receives the prompt immediately.
    const tempId = `tmp-${Date.now()}`;
    setMessages([{
      _id: tempId,
      chat: newChat._id,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    }]);
    setSending(true);
    try {
      const res = await workspaceChat.sendMessage(newChat._id, prompt);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m._id !== tempId);
        const next = [...withoutTemp];
        if (res.userMessage) next.push(res.userMessage);
        if (res.assistantMessage) next.push(res.assistantMessage);
        return next;
      });

      // Mirror sidebar preview + reorder + title derivation (same as
      // handleSend). Kept inline because the send is against a chat id
      // that isn't in `chats` yet in the shape handleSend expects.
      const previewSource = res.assistantMessage?.content || prompt;
      const previewAt = res.assistantMessage?.createdAt || new Date().toISOString();
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === newChat._id);
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          lastMessagePreview: previewSource.slice(0, 100),
          lastMessage: previewSource.slice(0, 100),
          lastMessageAt: previewAt,
          updatedAt: previewAt,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });

      // Auto-derive title from the seed prompt.
      const derived = deriveChatTitle(prompt);
      if (derived) {
        workspaceChat.renameChat(newChat._id, derived)
          .then(() => setChats((prev) => prev.map((c) => (
            c._id === newChat._id ? { ...c, title: derived } : c
          ))))
          .catch(() => { /* silent */ });
      }
    } catch (err) {
      setMessages([]);
      toast.error(err.message || 'Failed to start conversation.');
    } finally {
      setSending(false);
    }
  };

  const handleArchive = async (chatId) => {
    // Optimistic remove; if the archived chat was active, jump to the
    // next available one (or null if the list is now empty).
    const prevSnapshot = chats;
    const prevActive = activeChatId;
    setChats((prev) => {
      const remaining = prev.filter((c) => c._id !== chatId);
      if (chatId === activeChatId) {
        setActiveChatId(remaining[0]?._id || null);
      }
      return remaining;
    });
    try {
      await workspaceChat.archiveChat(chatId);
      toast.success('Chat archived.');
    } catch (err) {
      setChats(prevSnapshot);
      setActiveChatId(prevActive);
      throw err;
    }
  };

  const repoLabel = project ? `${project.repoOwner}/${project.repoName}` : '';

  // Tab strip — same shape as WorkspacePage, with Chat marked active here.
  const workspaceTabs = [
    { id: 'overview',   label: 'Overview',   href: `/projects/${id}` },
    { id: 'files',      label: 'Files',      href: `/projects/${id}` },
    { id: 'interviews', label: 'Interviews', href: `/projects/${id}` },
    { id: 'chat',       label: 'Chat' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D1117' }}>
      <Navbar />

      <div className="flex-1 pt-12">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-6">

          {projectLoading && (
            <div
              className="flex items-center justify-center py-10"
              style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: '#6B7280' }} />
              <span className="font-mono text-2xs ml-2" style={{ color: '#6B7280' }}>
                loading workspace…
              </span>
            </div>
          )}

          {!projectLoading && projectError && (
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}>
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load workspace"
                description={projectError}
                action={
                  <Link to="/projects" className="btn-secondary text-xs px-3 py-1.5">
                    Back to projects
                  </Link>
                }
              />
            </div>
          )}

          {!projectLoading && !projectError && project && (
            <>
              <SectionHeader
                eyebrow="workspace · chat"
                title={repoLabel ? `Chat with ${repoLabel}` : 'Workspace Chat'}
                subtitle="Ask questions about this project — grounded in its code and architecture."
                action={
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wide px-1.5 py-0.5"
                      style={{
                        color: '#58A6FF',
                        background: 'rgba(88,166,255,0.1)',
                        border: '1px solid rgba(88,166,255,0.3)',
                        borderRadius: 4,
                      }}
                    >
                      <Sparkles size={9} /> AI grounded in repo
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${id}`)}
                      className="inline-flex items-center gap-1.5 text-xs transition-colors"
                      style={{
                        color: '#9CA3AF', background: 'transparent',
                        border: 'none', cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F6FC')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
                    >
                      <ArrowLeft size={12} /> Back to workspace
                    </button>
                  </div>
                }
              />

              <WorkspaceTabs tabs={workspaceTabs} activeId="chat" onSelect={() => {}} />

              {/* Repo strip — visual anchor consistent with other Workspace pages. */}
              <div
                className="flex items-center gap-2 px-3 py-2 mt-4 mb-3"
                style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 6 }}
              >
                <GitBranch size={13} style={{ color: '#58A6FF' }} />
                <span className="text-sm font-medium" style={{ color: '#F0F6FC' }}>
                  {repoLabel}
                </span>
                {project.metadata?.language && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-2xs ml-1"
                    style={{
                      background: '#0D1117', border: '1px solid #30363D',
                      borderRadius: 3, color: '#6B7280',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#58A6FF' }} />
                    {project.metadata.language}
                  </span>
                )}
                {analysis?.status && (
                  <span
                    className="ml-auto font-mono text-2xs"
                    style={{ color: '#484F58' }}
                  >
                    analysis · {analysis.status}
                  </span>
                )}
              </div>

              {chatsError && (
                <div
                  className="flex items-start gap-2 px-3 py-2 mb-3"
                  style={{
                    background: 'rgba(248,81,73,0.08)',
                    border: '1px solid rgba(248,81,73,0.3)',
                    borderRadius: 6,
                  }}
                >
                  <AlertTriangle size={12} style={{ color: '#F85149', flexShrink: 0, marginTop: 2 }} />
                  <div className="text-xs" style={{ color: '#F0F6FC' }}>
                    {chatsError}
                  </div>
                </div>
              )}

              {/* 3-region layout: sidebar / window / input. Grid collapses
                  to a single column on narrow screens; sidebar hides on
                  mobile to preserve the conversation surface. */}
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 min-h-[520px]">
                <div className="hidden lg:block">
                  <ChatSidebar
                    chats={chats}
                    activeId={activeChatId}
                    loading={chatsLoading}
                    creating={creating}
                    onSelect={setActiveChatId}
                    onNewChat={handleNewChat}
                    onRename={handleRename}
                    onArchive={handleArchive}
                  />
                </div>
                <div className="flex flex-col gap-3 min-h-0">
                  <div className="flex-1 min-h-[360px]">
                    <ChatWindow
                      activeChat={activeChat}
                      messages={messages}
                      loading={messagesLoading}
                      error={messagesError}
                      sending={sending}
                      onRetry={() => loadMessages(activeChatId)}
                      onRegenerate={handleRegenerate}
                      regeneratingId={regeneratingId}
                      onSuggestPrompt={handleSuggestPrompt}
                      onQuickStart={handleQuickStart}
                    />
                  </div>
                  <ChatInput
                    ref={chatInputRef}
                    onSend={handleSend}
                    sending={sending}
                    disabled={!activeChatId}
                    restoreValue={restoreInput}
                  />
                </div>
              </div>

              <p className="font-mono text-2xs mt-4" style={{ color: '#484F58' }}>
                {'// v1.2.0 — markdown · syntax highlighting · regenerate · copy · smart scroll'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceChatPage;
