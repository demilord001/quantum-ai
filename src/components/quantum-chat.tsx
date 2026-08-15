"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  UserButton,
} from "@clerk/nextjs";

import {
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  History,
  Loader2,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

interface Source {
  title: string;
  url: string;
  favicon?: string;
}

interface ResearchResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
  publishedDate?: string;
  favicon?: string;
  sourceType?:
    | "web"
    | "page"
    | "youtube";
}

interface Message {
  role:
    | "user"
    | "assistant";

  content: string;

  sources?: Source[];

  research?: ResearchResult[];

  streamId?: string;
}

interface Conversation {
  _id: string;

  title: string;

  messages: Message[];

  createdAt?: string;

  updatedAt?: string;
}

type SearchStatus =
  | "idle"
  | "thinking"
  | "searching"
  | "analyzing"
  | "done"
  | "error";

interface QuantumChatProps {
  firstName: string;
}

export default function QuantumChat({
  firstName,
}: QuantumChatProps) {
  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [
    conversations,
    setConversations,
  ] = useState<Conversation[]>(
    []
  );

  const [
    conversationId,
    setConversationId,
  ] =
    useState<string | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [
    searchStatus,
    setSearchStatus,
  ] =
    useState<SearchStatus>(
      "idle"
    );

  const [
    desktopSidebarCollapsed,
    setDesktopSidebarCollapsed,
  ] =
    useState(false);

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  const [
    openMenuId,
    setOpenMenuId,
  ] =
    useState<string | null>(
      null
    );

  const [
    renamingId,
    setRenamingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    renameValue,
    setRenameValue,
  ] = useState("");

  const [
    sidebarSearch,
    setSidebarSearch,
  ] = useState("");

  const [
    autoScroll,
    setAutoScroll,
  ] = useState(true);

  const [
    copiedMessage,
    setCopiedMessage,
  ] = useState<number | null>(
    null
  );

  const [
    copiedCode,
    setCopiedCode,
  ] =
    useState<string | null>(
      null
    );

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );

  const messageAreaRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const bottomRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /* =======================================================
     CONVERSATIONS
  ======================================================= */

  const loadConversations =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/conversations",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        if (Array.isArray(data)) {
          setConversations(data);
        }
      } catch (error) {
        console.error(
          "Conversation loading error:",
          error
        );
      }
    }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  /* =======================================================
     ESC
  ======================================================= */

  useEffect(() => {
    function handleEscape(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setOpenMenuId(null);
        setRenamingId(null);
        setMobileSidebarOpen(
          false
        );
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleEscape
      );
  }, []);

  /* =======================================================
     SCROLL
  ======================================================= */

  useEffect(() => {
    if (!autoScroll) {
      return;
    }

    bottomRef.current?.scrollIntoView(
      {
        behavior: loading
          ? "auto"
          : "smooth",

        block: "end",
      }
    );
  }, [
    messages,
    loading,
    autoScroll,
  ]);

  function handleMessageScroll() {
    const element =
      messageAreaRef.current;

    if (!element) {
      return;
    }

    const distance =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    setAutoScroll(
      distance < 160
    );
  }

  /* =======================================================
     NEW CHAT
  ======================================================= */

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setMessage("");
    setSearchStatus("idle");
    setAutoScroll(true);
    setOpenMenuId(null);
    setRenamingId(null);
    setMobileSidebarOpen(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  /* =======================================================
     OPEN CHAT
  ======================================================= */

  async function openConversation(
    id: string
  ) {
    setOpenMenuId(null);

    try {
      const response =
        await fetch(
          `/api/conversations/${id}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load conversation."
        );
      }

      setConversationId(
        data._id
      );

      setMessages(
        Array.isArray(
          data.messages
        )
          ? data.messages
          : []
      );

      setMessage("");
      setAutoScroll(true);
      setMobileSidebarOpen(
        false
      );
      setSearchStatus("idle");
    } catch (error) {
      console.error(
        "Open conversation error:",
        error
      );
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function deleteConversation(
    id: string
  ) {
    try {
      const response =
        await fetch(
          `/api/conversations/${id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Delete failed."
        );
      }

      setConversations(
        (previous) =>
          previous.filter(
            (item) =>
              item._id !== id
          )
      );

      if (
        conversationId === id
      ) {
        startNewChat();
      }

      setOpenMenuId(null);
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );
    }
  }

  /* =======================================================
     RENAME
  ======================================================= */

  function startRename(
    conversation: Conversation
  ) {
    setRenameValue(
      conversation.title
    );

    setRenamingId(
      conversation._id
    );

    setOpenMenuId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function saveRename(
    id: string
  ) {
    const title =
      renameValue
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);

    if (!title) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/conversations/${id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title,
            }),
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Rename failed."
        );
      }

      setConversations(
        (previous) =>
          previous.map(
            (item) =>
              item._id === id
                ? {
                    ...item,
                    title:
                      data.title ||
                      title,
                  }
                : item
          )
      );

      cancelRename();
    } catch (error) {
      console.error(
        "Rename error:",
        error
      );
    }
  }

  /* =======================================================
     SEND
  ======================================================= */

  async function sendMessage() {
  const text = message.trim();

  if (!text || loading) {
    return;
  }

  const streamId =
    `stream-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const history =
    messages
      .filter(
        (item) =>
          item.role === "user" ||
          item.role === "assistant"
      )
      .slice(-4);

  setMessages((previous) => [
    ...previous,

    {
      role: "user",
      content: text,
    },

    {
      role: "assistant",
      content: "",
      sources: [],
      research: [],
      streamId,
    },
  ]);

  setMessage("");
  setLoading(true);
  setSearchStatus("thinking");
  setAutoScroll(true);

  try {
    const response = await fetch(
      "/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          message: text,
          conversationId,
          history,
        }),
      }
    );

    if (!response.ok) {
      const data =
        await response
          .json()
          .catch(() => null);

      throw new Error(
        data?.error ||
          `Quantum request failed (${response.status}).`
      );
    }

    if (!response.body) {
      throw new Error(
        "Quantum returned no stream."
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";

    while (true) {
      const {
        value,
        done,
      } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        {
          stream: true,
        }
      );

      const events =
        buffer.split("\n\n");

      buffer =
        events.pop() || "";

      for (
        const event of events
      ) {
        const dataLine =
          event
            .split("\n")
            .find(
              (line) =>
                line.startsWith(
                  "data:"
                )
            );

        if (!dataLine) {
          continue;
        }

        const payload =
          dataLine
            .replace(
              /^data:\s*/,
              ""
            )
            .trim();

        if (!payload) {
          continue;
        }

        let data: any;

        try {
          data =
            JSON.parse(
              payload
            );
        } catch {
          continue;
        }

        if (
          data.type === "status"
        ) {
          setSearchStatus(
            data.status ||
              "thinking"
          );

          continue;
        }

        if (
          data.type ===
          "research"
        ) {
          setMessages(
            (previous) =>
              previous.map(
                (item) =>
                  item.streamId ===
                  streamId
                    ? {
                        ...item,

                        research:
                          data.results ||
                          [],
                      }
                    : item
              )
          );

          setSearchStatus(
            "analyzing"
          );

          continue;
        }

        if (
          data.type === "chunk"
        ) {
          if (!data.text) {
            continue;
          }

          setMessages(
            (previous) =>
              previous.map(
                (item) =>
                  item.streamId ===
                  streamId
                    ? {
                        ...item,

                        content:
                          item.content +
                          data.text,
                      }
                    : item
              )
          );

          setSearchStatus(
            "analyzing"
          );

          continue;
        }

        if (
          data.type === "done"
        ) {
          setConversationId(
            data.conversationId ||
              null
          );

          setMessages(
            (previous) =>
              previous.map(
                (item) =>
                  item.streamId ===
                  streamId
                    ? {
                        role:
                          item.role,

                        content:
                          item.content,

                        sources:
                          data.sources ||
                          item.sources ||
                          [],

                        research:
                          item.research ||
                          [],
                      }
                    : item
              )
          );

          setSearchStatus(
            "done"
          );

          await loadConversations();

          continue;
        }

        if (
          data.type === "error"
        ) {
          throw new Error(
            data.error ||
              "Quantum failed."
          );
        }
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Something went wrong.";

    console.error(
      "Quantum client error:",
      error
    );

    setMessages(
      (previous) =>
        previous.map(
          (item) =>
            item.streamId ===
            streamId
              ? {
                  ...item,

                  content:
                    `**Quantum error**\n\n${errorMessage}`,
                }
              : item
        )
    );

    setSearchStatus(
      "error"
    );
  } finally {
    setLoading(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }
}

  /* =======================================================
     KEYBOARD
  ======================================================= */

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void sendMessage();
    }
  }

  /* =======================================================
     COPY
  ======================================================= */

  async function copyAnswer(
    content: string,
    index: number
  ) {
    try {
      await navigator.clipboard.writeText(
        content
      );

      setCopiedMessage(index);

      setTimeout(() => {
        setCopiedMessage(null);
      }, 1500);
    } catch {}
  }

  async function copyCode(
    code: string,
    id: string
  ) {
    try {
      await navigator.clipboard.writeText(
        code
      );

      setCopiedCode(id);

      setTimeout(() => {
        setCopiedCode(null);
      }, 1500);
    } catch {}
  }

  const filteredConversations =
    conversations.filter(
      (item) =>
        item.title
          .toLowerCase()
          .includes(
            sidebarSearch
              .trim()
              .toLowerCase()
          )
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-[#020617] text-white">

      {/* BACKGROUND */}

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[28%] top-[-280px] h-[650px] w-[650px] rounded-full bg-cyan-400/[0.045] blur-[170px]" />

        <div className="absolute bottom-[-250px] right-[-100px] h-[600px] w-[600px] rounded-full bg-violet-500/[0.04] blur-[170px]" />

        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              `
              linear-gradient(
                rgba(255,255,255,0.025) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,0.025) 1px,
                transparent 1px
              )
            `,

            backgroundSize:
              "48px 48px",
          }}
        />
      </div>

      {/* MOBILE OVERLAY */}

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setMobileSidebarOpen(
              false
            )
          }
          className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`
          absolute inset-y-0 left-0 z-50
          flex
          w-[280px]
          min-w-[280px]
          flex-col
          border-r border-white/[0.07]
          bg-[#030712]/97
          backdrop-blur-2xl
          transition-all duration-300
          lg:relative
          lg:z-20

          ${
            mobileSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }

          ${
            desktopSidebarCollapsed
              ? "lg:w-0 lg:min-w-0 lg:overflow-hidden lg:border-r-0"
              : "lg:translate-x-0"
          }
        `}
      >
        <div className="flex h-full w-[280px] flex-col">

          {/* SIDEBAR HEADER */}

          <div className="flex h-[72px] shrink-0 items-center gap-3 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06]">
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-[0.15em]">
                QUANTUM
              </p>

              <p className="text-[8px] tracking-[0.34em] text-slate-600">
                INTELLIGENCE
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setDesktopSidebarCollapsed(
                  true
                )
              }
              className="ml-auto hidden h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white/[0.05] hover:text-slate-300 lg:flex"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileSidebarOpen(
                  false
                )
              }
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white/[0.05] hover:text-slate-300 lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* NEW */}

          <div className="shrink-0 px-4">
            <button
              type="button"
              onClick={startNewChat}
              className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-slate-300 hover:border-cyan-300/20 hover:bg-white/[0.055]"
            >
              <Plus className="h-4 w-4 text-cyan-300 group-hover:scale-110" />

              New chat
            </button>
          </div>

          {/* SEARCH */}

          <div className="shrink-0 px-4 pt-5">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <Search className="h-4 w-4 text-slate-600" />

              <input
                value={
                  sidebarSearch
                }
                onChange={(
                  event
                ) =>
                  setSidebarSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search chats"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* HISTORY */}

          <div className="quantum-scroll mt-7 min-h-0 flex-1 overflow-y-auto px-3">
            <div className="mb-3 flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.18em] text-slate-600">
              <History className="h-3.5 w-3.5" />

              Recent
            </div>

            {filteredConversations.length ===
            0 ? (
              <p className="px-2 text-xs text-slate-700">
                {sidebarSearch.trim()
                  ? "No matching conversations."
                  : "No conversations yet."}
              </p>
            ) : (
              <div className="space-y-1 pb-5">
                {filteredConversations.map(
                  (
                    conversation
                  ) => {
                    const open =
                      openMenuId ===
                      conversation._id;

                    const renaming =
                      renamingId ===
                      conversation._id;

                    return (
                      <div
                        key={
                          conversation._id
                        }
                        className="relative flex min-h-[44px] items-center rounded-xl hover:bg-white/[0.03]"
                      >
                        {renaming ? (
                          <form
                            onSubmit={(
                              event
                            ) => {
                              event.preventDefault();

                              void saveRename(
                                conversation._id
                              );
                            }}
                            className="flex w-full items-center gap-1 px-2 py-1.5"
                          >
                            <input
                              autoFocus
                              value={
                                renameValue
                              }
                              onChange={(
                                event
                              ) =>
                                setRenameValue(
                                  event
                                    .target
                                    .value
                                )
                              }
                              onKeyDown={(
                                event
                              ) => {
                                if (
                                  event.key ===
                                  "Escape"
                                ) {
                                  cancelRename();
                                }
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-cyan-300/20 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 outline-none"
                            />

                            <button
                              type="submit"
                              className="rounded-lg px-2 py-1.5 text-[10px] text-cyan-300 hover:bg-cyan-300/[0.06]"
                            >
                              Save
                            </button>
                          </form>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void openConversation(
                                  conversation._id
                                )
                              }
                              className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm text-slate-500 hover:text-slate-300"
                            >
                              {
                                conversation.title
                              }
                            </button>

                            <button
                              type="button"
                              onPointerDown={(
                                event
                              ) =>
                                event.stopPropagation()
                              }
                              onClick={(
                                event
                              ) => {
                                event.stopPropagation();

                                setOpenMenuId(
                                  (
                                    current
                                  ) =>
                                    current ===
                                    conversation._id
                                      ? null
                                      : conversation._id
                                );
                              }}
                              className={`mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                open
                                  ? "bg-white/[0.08] text-slate-200"
                                  : "text-slate-700 hover:bg-white/[0.06] hover:text-slate-300"
                              }`}
                              aria-label="Conversation options"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>

                            {open && (
                              <div
                                onPointerDown={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }
                                className="absolute right-2 top-[45px] z-[999] w-40 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0a0f1d] p-1 shadow-2xl shadow-black/60"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    startRename(
                                      conversation
                                    )
                                  }
                                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white"
                                >
                                  Rename
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteConversation(
                                      conversation._id
                                    )
                                  }
                                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs text-red-400 hover:bg-red-400/[0.08]"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* SETTINGS */}

          <div className="shrink-0 border-t border-white/[0.06] p-4">
            <a
  href="/settings"
  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-white/[0.035] hover:text-slate-300"
>
  <Settings className="h-4 w-4" />

  Settings
</a>
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <section className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

        {/* TOP BAR */}

        <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-white/[0.05] bg-black/10 px-4 backdrop-blur-2xl sm:px-6">

          <div className="flex items-center gap-3">

            {/* MOBILE */}

            <button
              type="button"
              onClick={() =>
                setMobileSidebarOpen(
                  true
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-500 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* DESKTOP */}

            {desktopSidebarCollapsed && (
              <button
                type="button"
                onClick={() =>
                  setDesktopSidebarCollapsed(
                    false
                  )
                }
                className="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-500 hover:border-cyan-300/15 hover:text-cyan-300 lg:flex"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <div>
              <p className="text-sm font-medium text-slate-300">
                Quantum AI
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />

                <span className="text-[10px] text-slate-600">
                  Live intelligence
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3">
  <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[9px] tracking-[0.15em] text-slate-700 sm:flex">
    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

    LIVE
  </div>

  <UserButton
    showName={false}
    appearance={{
      elements: {
        avatarBox:
          "h-8 w-8 border border-cyan-300/15 shadow-[0_0_20px_rgba(34,211,238,0.08)]",
      },
    }}
  />
</div>
          </div>
        </header>

        {/* CHAT */}

        <div
          ref={
            messageAreaRef
          }
          onScroll={
            handleMessageScroll
          }
          className="quantum-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth"
        >
          {messages.length ===
          0 ? (
            <EmptyState
              firstName={
                firstName
              }
              setMessage={
                setMessage
              }
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
              <div className="space-y-10 pb-10">

                {messages.map(
                  (
                    item,
                    index
                  ) => (
                    <MessageBubble
                      key={`${index}-${item.role}-${item.streamId || ""}`}
                      item={item}
                      index={index}
                      copiedMessage={
                        copiedMessage
                      }
                      copiedCode={
                        copiedCode
                      }
                      copyAnswer={
                        copyAnswer
                      }
                      copyCode={
                        copyCode
                      }
                    />
                  )
                )}

                <div
                  ref={
                    bottomRef
                  }
                  className="h-4"
                />
              </div>
            </div>
          )}
        </div>

        {/* COMPOSER */}

        <div className="shrink-0 border-t border-white/[0.05] bg-[#020617]/90 px-4 pb-4 pt-3 backdrop-blur-2xl sm:px-6">
          <div className="mx-auto w-full max-w-3xl">

            <div className="relative overflow-hidden rounded-[24px] border border-white/[0.10] bg-white/[0.035] p-2 shadow-[0_0_70px_rgba(34,211,238,0.025)] backdrop-blur-2xl focus-within:border-cyan-300/20 focus-within:shadow-[0_0_90px_rgba(34,211,238,0.07)]">

              <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

              <textarea
                ref={
                  textareaRef
                }
                value={
                  message
                }
                onChange={(
                  event
                ) =>
                  setMessage(
                    event.target
                      .value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                disabled={
                  loading
                }
                rows={1}
                placeholder="Ask Quantum anything..."
                className="min-h-[48px] max-h-[140px] w-full resize-none overflow-y-auto bg-transparent px-4 py-3 text-[15px] leading-6 text-slate-200 outline-none placeholder:text-slate-600"
              />

              <div className="flex items-center justify-between px-2 pb-1 pt-1">

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.025] px-3 py-2 text-[11px] text-slate-500">
                    <Globe2 className="h-3.5 w-3.5 text-cyan-300" />
                    Live web
                  </div>

                  {searchStatus ===
                    "searching" && (
                    <span className="text-[10px] text-cyan-300/70">
                      Searching...
                    </span>
                  )}

                  {searchStatus ===
                    "analyzing" && (
                    <span className="text-[10px] text-violet-300/70">
                      Synthesizing...
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void sendMessage()
                  }
                  disabled={
                    loading ||
                    !message.trim()
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black transition hover:scale-105 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
                  aria-label="Send message"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="mt-2 text-center text-[10px] text-slate-700">
              Quantum can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  firstName,
  setMessage,
}: {
  firstName: string;

  setMessage: (
    value: string
  ) => void;
}) {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">

        <div className="relative mb-8 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-2xl" />

          <div className="absolute h-16 w-16 rounded-full border border-cyan-300/15 animate-[spin_12s_linear_infinite]" />

          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.10] to-violet-500/[0.10]">
            <Sparkles className="h-6 w-6 text-cyan-200" />
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Real-time AI research assistant
        </p>

        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          What next,{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">
            {firstName}?
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500">
          Search the live web, read pages, explore
          complex questions, and get beautifully
          structured answers.
        </p>

        <div className="mt-9 grid gap-3 sm:grid-cols-2">
          <PromptCard
            label="LIVE RESEARCH"
            text="What's happening in AI today?"
            onClick={() =>
              setMessage(
                "What's happening in AI today?"
              )
            }
          />

          <PromptCard
            label="ANALYSIS"
            text="Compare Next.js and Remix."
            onClick={() =>
              setMessage(
                "Compare Next.js and Remix."
              )
            }
          />

          <PromptCard
            label="PAGE READING"
            text="Read and explain this web page."
            onClick={() =>
              setMessage(
                "Read and explain https://nextjs.org/docs"
              )
            }
          />

          <PromptCard
            label="RESEARCH"
            text="Research the best backend frameworks for startups."
            onClick={() =>
              setMessage(
                "Research the best backend frameworks for startups."
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PROMPTS
========================================================= */

function PromptCard({
  label,
  text,
  onClick,
}: {
  label: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/15 hover:bg-white/[0.04]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-semibold tracking-[0.2em] text-slate-700 group-hover:text-cyan-300/60">
          {label}
        </span>

        <Sparkles className="h-3.5 w-3.5 text-slate-700 group-hover:text-cyan-300" />
      </div>

      <p className="text-sm leading-6 text-slate-400 group-hover:text-slate-200">
        {text}
      </p>
    </button>
  );
}

/* =========================================================
   MESSAGE
========================================================= */

function MessageBubble({
  item,
  index,
  copiedMessage,
  copiedCode,
  copyAnswer,
  copyCode,
}: {
  item: Message;

  index: number;

  copiedMessage:
    | number
    | null;

  copiedCode:
    | string
    | null;

  copyAnswer: (
    content: string,
    index: number
  ) => void;

  copyCode: (
    code: string,
    codeId: string
  ) => void;
}) {
  if (
    item.role ===
    "user"
  ) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-white/[0.07] px-5 py-3.5 text-[15px] leading-7 text-slate-200">
          {item.content}
        </div>
      </div>
    );
  }

  return (
    <article>
      {/* QUANTUM */}

      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07]">
          <Sparkles className="h-4 w-4 text-cyan-300" />
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.15em] text-cyan-300">
            QUANTUM
          </p>

          <p className="text-[9px] text-slate-700">
            AI RESEARCH ASSISTANT
          </p>
        </div>
      </div>

      {/* RESEARCH */}

      {item.research &&
        item.research.length >
          0 && (
          <ResearchPanel
            results={
              item.research
            }
          />
        )}

      {/* ANSWER CARD */}

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] shadow-[0_20px_70px_rgba(0,0,0,0.16)]">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.018] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Answer
            </span>
          </div>

          {item.content && (
            <button
              type="button"
              onClick={() =>
                void copyAnswer(
                  item.content,
                  index
                )
              }
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-700 hover:bg-white/[0.05] hover:text-slate-300"
            >
              {copiedMessage ===
              index ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>

        {/* BODY */}

        <div className="p-5 sm:p-6">
          {item.content ? (
            <FormattedAnswer
              content={
                item.content
              }
              copiedCode={
                copiedCode
              }
              copyCode={
                copyCode
              }
            />
          ) : (
            <SearchProgress />
          )}
        </div>
      </div>

      {/* SOURCES */}

      {item.sources &&
        item.sources.length >
          0 && (
          <div className="mt-7">
            <div className="mb-3 flex items-center gap-2">
              <Globe2 className="h-3.5 w-3.5 text-cyan-300/70" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Sources
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {item.sources.map(
                (
                  source,
                  index
                ) => (
                  <a
                    key={`${source.url}-${index}`}
                    href={
                      source.url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3 hover:border-cyan-300/15 hover:bg-white/[0.035]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/[0.04]">
                      <Globe2 className="h-3.5 w-3.5 text-cyan-300/70" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-400 group-hover:text-white">
                        {
                          source.title
                        }
                      </p>

                      <p className="truncate text-[10px] text-slate-700">
                        {
                          source.url
                        }
                      </p>
                    </div>

                    <ExternalLink className="h-3.5 w-3.5 text-slate-700 group-hover:text-cyan-300" />
                  </a>
                )
              )}
            </div>
          </div>
        )}
    </article>
  );
}

/* =========================================================
   RESEARCH
========================================================= */

function ResearchPanel({
  results,
}: {
  results: ResearchResult[];
}) {
  if (!results.length) {
    return null;
  }

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-cyan-300/[0.10] bg-cyan-300/[0.025]">

      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-cyan-300" />

          <div>
            <p className="text-xs font-medium text-cyan-200">
              Live web research
            </p>

            <p className="text-[10px] text-slate-700">
              Sources used by Quantum
            </p>
          </div>
        </div>

        <span className="rounded-full border border-white/[0.06] px-2.5 py-1 text-[10px] text-slate-600">
          {results.length}
        </span>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {results.map(
          (
            result,
            index
          ) => (
            <a
              key={`${result.url}-${index}`}
              href={
                result.url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-white/[0.06] bg-black/20 p-3 hover:border-cyan-300/15 hover:bg-white/[0.03]"
            >
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] font-semibold text-cyan-300">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-medium leading-5 text-slate-300 group-hover:text-white">
                    {
                      result.title
                    }
                  </p>

                  {result.content && (
                    <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-600">
                      {
                        result.content
                      }
                    </p>
                  )}

                  <p className="mt-2 truncate text-[9px] text-slate-700">
                    {getHostname(
                      result.url
                    )}
                  </p>
                </div>

                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-700 group-hover:text-cyan-300" />
              </div>
            </a>
          )
        )}
      </div>
    </div>
  );
}

/* =========================================================
   FORMATTED ANSWER
========================================================= */

function FormattedAnswer({
  content,
  copiedCode,
  copyCode,
}: {
  content: string;

  copiedCode:
    | string
    | null;

  copyCode: (
    code: string,
    codeId: string
  ) => void;
}) {
  return (
    <div className="quantum-answer overflow-x-auto text-[15px] leading-7 text-slate-300">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
        ]}
        components={{
          h1({ children }) {
            return (
              <h1 className="mb-5 mt-0 text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                {children}
              </h1>
            );
          },

          h2({ children }) {
            return (
              <h2 className="mb-3 mt-8 text-xl font-bold text-white sm:text-2xl">
                {children}
              </h2>
            );
          },

          h3({ children }) {
            return (
              <h3 className="mb-2 mt-6 text-base font-semibold text-slate-100 sm:text-lg">
                {children}
              </h3>
            );
          },

          p({ children }) {
            return (
              <p className="mb-5 max-w-[72ch] leading-7 text-slate-300">
                {children}
              </p>
            );
          },

          strong({ children }) {
            return (
              <strong className="font-semibold text-white">
                {children}
              </strong>
            );
          },

          ul({ children }) {
            return (
              <ul className="mb-5 space-y-2 pl-6 marker:text-cyan-300">
                {children}
              </ul>
            );
          },

          ol({ children }) {
            return (
              <ol className="mb-5 space-y-2 pl-6 marker:text-cyan-300">
                {children}
              </ol>
            );
          },

          li({ children }) {
            return (
              <li className="pl-1">
                {children}
              </li>
            );
          },

          blockquote({ children }) {
            return (
              <blockquote className="my-6 rounded-r-xl border-l-2 border-cyan-300/30 bg-cyan-300/[0.025] px-5 py-4 text-slate-400">
                {children}
              </blockquote>
            );
          },

          a({
            children,
            href,
          }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
              >
                {children}
              </a>
            );
          },

          table({ children }) {
            return (
              <div className="quantum-scroll my-7 overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="min-w-[650px] w-full border-collapse">
                  {children}
                </table>
              </div>
            );
          },

          thead({ children }) {
            return (
              <thead className="bg-white/[0.045]">
                {children}
              </thead>
            );
          },

          th({ children }) {
            return (
              <th className="border border-white/[0.07] px-4 py-3 text-left text-xs font-semibold text-white">
                {children}
              </th>
            );
          },

          td({ children }) {
            return (
              <td className="border border-white/[0.06] px-4 py-3 text-sm text-slate-400">
                {children}
              </td>
            );
          },

          pre({ children }) {
            const child =
              children as React.ReactElement<{
                className?: string;
                children?: string;
              }>;

            const className =
              child?.props?.className ||
              "";

            const match =
              /language-(\w+)/.exec(
                className
              );

            const language =
              match?.[1] ||
              "code";

            const code =
              String(
                child?.props
                  ?.children ||
                  ""
              ).replace(
                /\n$/,
                ""
              );

            const codeId =
              `${language}-${code.slice(
                0,
                40
              )}`;

            return (
              <div className="my-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#030712]">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />

                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />

                    <span className="h-2.5 w-2.5 rounded-full bg-green-400/60" />

                    <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-slate-600">
                      {language}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void copyCode(
                        code,
                        codeId
                      )
                    }
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-600 hover:bg-white/[0.05] hover:text-slate-300"
                  >
                    {copiedCode ===
                    codeId ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="quantum-scroll overflow-x-auto p-5">
                  <pre className="m-0 bg-transparent p-0">
                    <code className="font-mono text-[13px] leading-6 text-slate-300">
                      {code}
                    </code>
                  </pre>
                </div>
              </div>
            );
          },

          code({ children }) {
            return (
              <code className="rounded-md border border-cyan-300/10 bg-cyan-300/[0.05] px-1.5 py-0.5 font-mono text-[0.9em] text-cyan-300">
                {children}
              </code>
            );
          },

          hr() {
            return (
              <hr className="my-8 border-white/[0.08]" />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/* =========================================================
   STATUS
========================================================= */

function SearchProgress() {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-600">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />

        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.15s]" />

        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" />
      </div>

      Quantum is thinking...
    </div>
  );
}

function getHostname(
  url: string
) {
  try {
    return new URL(url)
      .hostname;
  } catch {
    return url;
  }
}