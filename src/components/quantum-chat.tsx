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
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  History,
  Loader2,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

/* =========================================================
   TYPES
========================================================= */

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
}

interface Message {
  role: "user" | "assistant";
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

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function QuantumChat({
  firstName,
}: QuantumChatProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(
    []
  );

  const [conversations, setConversations] = useState<
    Conversation[]
  >([]);

  const [conversationId, setConversationId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [searchStatus, setSearchStatus] =
    useState<SearchStatus>("idle");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [copiedMessage, setCopiedMessage] =
    useState<number | null>(null);

  const [copiedCode, setCopiedCode] = useState<
    string | null
  >(null);

  const [autoScroll, setAutoScroll] =
    useState(true);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const messagesContainerRef =
    useRef<HTMLDivElement | null>(null);

  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  /* =======================================================
     LOAD CONVERSATIONS
  ======================================================= */

  const loadConversations =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/conversations",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => null);

          console.error(
            "Failed to load conversations:",
            response.status,
            errorData
          );

          return;
        }

        const data = await response.json();

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
     AUTO SCROLL
  ======================================================= */

  useEffect(() => {
    if (!autoScroll) {
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: loading ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, loading, autoScroll]);

  /* =======================================================
     DETECT MANUAL SCROLL
  ======================================================= */

  function handleMessageScroll() {
    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    setAutoScroll(
      distanceFromBottom < 160
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
    setSidebarOpen(false);

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  /* =======================================================
     OPEN CONVERSATION
  ======================================================= */

  async function openConversation(
    id: string
  ) {
    try {
      const response = await fetch(
        `/api/conversations/${id}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => null);

        throw new Error(
          errorData?.error ||
            "Unable to open conversation."
        );
      }

      const data = await response.json();

      setConversationId(data._id);
      setMessages(data.messages || []);
      setMessage("");
      setSearchStatus("idle");
      setAutoScroll(true);
      setSidebarOpen(false);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } catch (error) {
      console.error(
        "Open conversation error:",
        error
      );
    }
  }

  /* =======================================================
     DELETE CONVERSATION
  ======================================================= */

  async function deleteConversation(
    id: string
  ) {
    try {
      const response = await fetch(
        `/api/conversations/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => null);

        throw new Error(
          errorData?.error ||
            "Unable to delete conversation."
        );
      }

      setConversations((previous) =>
        previous.filter(
          (conversation) =>
            conversation._id !== id
        )
      );

      if (conversationId === id) {
        startNewChat();
      }
    } catch (error) {
      console.error(
        "Delete conversation error:",
        error
      );
    }
  }

  /* =======================================================
     SEND + STREAM
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

    /*
     * Important:
     * history contains previous messages only.
     */

    const history = [...messages];

    const userMessage: Message = {
      role: "user",
      content: text,
    };

    const assistantPlaceholder: Message = {
      role: "assistant",
      content: "",
      sources: [],
      research: [],
      streamId,
    };

    setMessages((previous) => [
      ...previous,
      userMessage,
      assistantPlaceholder,
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
        let errorMessage =
          `Quantum request failed (${response.status}).`;

        try {
          const data =
            await response.json();

          if (data?.error) {
            errorMessage = data.error;
          }
        } catch {
          // Ignore non-JSON error response.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error(
          "Quantum returned no streaming response."
        );
      }

      const reader =
        response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(
          value,
          {
            stream: true,
          }
        );

        const events = buffer.split(
          "\n\n"
        );

        buffer =
          events.pop() || "";

        for (const event of events) {
          if (!event.trim()) {
            continue;
          }

          const dataLine = event
            .split("\n")
            .find((line) =>
              line.startsWith("data:")
            );

          if (!dataLine) {
            continue;
          }

          const jsonText =
            dataLine
              .replace(/^data:\s*/, "")
              .trim();

          if (!jsonText) {
            continue;
          }

          let data: {
            type: string;
            status?: SearchStatus;
            text?: string;
            sources?: Source[];
            results?: ResearchResult[];
            conversationId?: string;
            searched?: boolean;
            error?: string;
          };

          try {
            data = JSON.parse(
              jsonText
            );
          } catch {
            console.warn(
              "Invalid stream event:",
              jsonText
            );

            continue;
          }

          /* ==============================================
             STATUS
          ============================================== */

          if (data.type === "status") {
            setSearchStatus(
              data.status || "thinking"
            );

            continue;
          }

          /* ==============================================
             RESEARCH
          ============================================== */

          if (data.type === "research") {
            const research =
              data.results || [];

            setMessages((previous) =>
              previous.map((item) => {
                if (
                  item.streamId !==
                  streamId
                ) {
                  return item;
                }

                return {
                  ...item,
                  research,
                };
              })
            );

            setSearchStatus("analyzing");

            continue;
          }

          /* ==============================================
             SOURCES
          ============================================== */

          if (data.type === "sources") {
            const sources =
              data.sources || [];

            setMessages((previous) =>
              previous.map((item) => {
                if (
                  item.streamId !==
                  streamId
                ) {
                  return item;
                }

                return {
                  ...item,
                  sources,
                };
              })
            );

            continue;
          }

          /* ==============================================
             TEXT CHUNK
          ============================================== */

          if (data.type === "chunk") {
            if (!data.text) {
              continue;
            }

            setSearchStatus("analyzing");

            setMessages((previous) =>
              previous.map((item) => {
                if (
                  item.streamId !==
                  streamId
                ) {
                  return item;
                }

                return {
                  ...item,
                  content:
                    item.content +
                    data.text,
                };
              })
            );

            continue;
          }

          /* ==============================================
             DONE
          ============================================== */

          if (data.type === "done") {
            setConversationId(
              data.conversationId ||
                null
            );

            setSearchStatus("done");

            setMessages((previous) =>
              previous.map((item) => {
                if (
                  item.streamId !==
                  streamId
                ) {
                  return item;
                }

                return {
                  role: item.role,
                  content: item.content,
                  sources:
                    item.sources ||
                    data.sources ||
                    [],
                  research:
                    item.research || [],
                };
              })
            );

            await loadConversations();

            continue;
          }

          /* ==============================================
             SERVER ERROR
          ============================================== */

          if (data.type === "error") {
            throw new Error(
              data.error ||
                "Quantum stream failed."
            );
          }
        }
      }

      decoder.decode();
    } catch (error) {
      console.error(
        "Quantum frontend error:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setMessages((previous) =>
        previous.map((item) => {
          if (
            item.streamId !==
            streamId
          ) {
            return item;
          }

          return {
            ...item,
            content:
              `**Quantum error**\n\n${errorMessage}`,
          };
        })
      );

      setSearchStatus("error");
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
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void sendMessage();
    }
  }

  /* =======================================================
     COPY ANSWER
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
    } catch (error) {
      console.error(
        "Copy answer failed:",
        error
      );
    }
  }

  /* =======================================================
     COPY CODE
  ======================================================= */

  async function copyCode(
    code: string,
    codeId: string
  ) {
    try {
      await navigator.clipboard.writeText(
        code
      );

      setCopiedCode(codeId);

      setTimeout(() => {
        setCopiedCode(null);
      }, 1500);
    } catch (error) {
      console.error(
        "Copy code failed:",
        error
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-[#020617] text-white">

      {/* ===================================================
          FUTURISTIC BACKGROUND
      =================================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Cyan Aurora */}

        <div className="absolute left-[25%] top-[-280px] h-[680px] w-[680px] rounded-full bg-cyan-400/[0.055] blur-[170px]" />

        {/* Violet Aurora */}

        <div className="absolute bottom-[-260px] right-[-120px] h-[620px] w-[620px] rounded-full bg-violet-500/[0.05] blur-[170px]" />

        {/* Blue Accent */}

        <div className="absolute left-[-220px] top-[40%] h-[500px] w-[500px] rounded-full bg-sky-400/[0.03] blur-[160px]" />

        {/* Grid */}

        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(255,255,255,0.022) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,0.022) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Center vignette */}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(2,6,23,0.5)_100%)]" />
      </div>

      {/* ===================================================
          MOBILE SIDEBAR BACKDROP
      =================================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="absolute inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        className={`absolute inset-y-0 left-0 z-50 flex w-[285px] flex-col border-r border-white/[0.07] bg-[#030712]/96 backdrop-blur-2xl transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* BRAND */}

        <div className="flex h-[78px] shrink-0 items-center gap-3 px-5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <div className="absolute inset-0 rounded-xl bg-cyan-300/[0.04] blur-md" />

            <Sparkles className="relative h-5 w-5 text-cyan-300" />

            <div className="absolute inset-0 rounded-xl border border-cyan-300/10 animate-pulse" />
          </div>

          <div>
            <p className="text-sm font-semibold tracking-[0.16em]">
              QUANTUM
            </p>

            <p className="mt-0.5 text-[9px] tracking-[0.36em] text-slate-600">
              INTELLIGENCE
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-white/[0.04] hover:text-slate-300 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* NEW CHAT */}

        <div className="shrink-0 px-4">
          <button
            type="button"
            onClick={startNewChat}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-300 transition duration-200 hover:border-cyan-300/20 hover:bg-white/[0.06]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">
              <Plus className="h-4 w-4 text-cyan-300 transition group-hover:scale-110" />
            </span>

            New Chat
          </button>
        </div>

        {/* SEARCH */}

        <div className="shrink-0 px-4 pt-5">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 transition focus-within:border-cyan-300/15 focus-within:bg-white/[0.035]">
            <Search className="h-4 w-4 shrink-0 text-slate-600" />

            <input
              type="text"
              placeholder="Search chats"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* CONVERSATION HISTORY */}

        <div className="quantum-scroll mt-7 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <div className="mb-3 flex items-center gap-2 px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
            <History className="h-3.5 w-3.5" />
            Recent
          </div>

          {conversations.length === 0 ? (
            <p className="px-2 pb-4 text-xs text-slate-700">
              No chats yet.
            </p>
          ) : (
            <div className="space-y-1 pb-4">
              {conversations.map(
                (conversation) => (
                  <div
                    key={
                      conversation._id
                    }
                    className={`group flex items-center rounded-xl transition ${
                      conversationId ===
                      conversation._id
                        ? "bg-white/[0.05]"
                        : "hover:bg-white/[0.035]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void openConversation(
                          conversation._id
                        )
                      }
                      className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm text-slate-500 transition hover:text-slate-300"
                    >
                      {
                        conversation.title
                      }
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteConversation(
                          conversation._id
                        )
                      }
                      className="mr-2 hidden h-7 w-7 items-center justify-center rounded-lg text-slate-700 transition hover:bg-red-400/10 hover:text-red-300 group-hover:flex"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* SETTINGS */}

        <div className="shrink-0 border-t border-white/[0.06] p-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-white/[0.035] hover:text-slate-400"
          >
            <UserButton />
            SETTINGS
          </button>
        </div>
      </aside>

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <section className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

        {/* HEADER */}

        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.05] bg-black/10 px-4 backdrop-blur-2xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-500 transition hover:text-slate-300 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div>
              <p className="text-sm font-medium text-slate-300">
                Quantum AI
              </p>

              <div className="mt-0.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />

                <span className="text-[10px] text-slate-600">
                  Live intelligence
                </span>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[10px] tracking-wide text-slate-600 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

            Powered By DemLabs
          </div>
        </header>

        {/* =================================================
            SCROLLABLE MESSAGE AREA
        ================================================= */}

        <div
          ref={messagesContainerRef}
          onScroll={handleMessageScroll}
          className="quantum-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth"
        >
          {messages.length === 0 ? (
            <EmptyState
              firstName={firstName}
              setMessage={setMessage}
            />
          ) : (
            <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
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
                  ref={bottomRef}
                  className="h-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            COMPACT FIXED COMPOSER
        ================================================= */}

        <div className="shrink-0 border-t border-white/[0.05] bg-[#020617]/82 px-4 pb-4 pt-3 backdrop-blur-2xl sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-[24px] border border-white/[0.10] bg-white/[0.035] p-2 shadow-[0_0_70px_rgba(34,211,238,0.035)] backdrop-blur-2xl transition-all duration-200 focus-within:border-cyan-300/20 focus-within:shadow-[0_0_90px_rgba(34,211,238,0.075)]">

              {/* Neon line */}

              <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

              {/* COMPACT TEXTAREA */}

              <textarea
                ref={textareaRef}
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                disabled={loading}
                rows={1}
                placeholder="Ask Quantum anything..."
                className="min-h-[48px] max-h-[140px] w-full resize-none overflow-y-auto bg-transparent px-4 py-3 text-[15px] leading-6 text-slate-200 outline-none placeholder:text-slate-600 disabled:opacity-50"
              />

              {/* CONTROLS */}

              <div className="flex items-center justify-between px-2 pt-1 pb-1">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.025] px-3 py-2 text-[11px] text-slate-500">
                    <Globe2 className="h-3.5 w-3.5 text-cyan-300" />

                    Live web
                  </div>

                  {searchStatus ===
                    "searching" && (
                    <span className="hidden text-[10px] text-cyan-300/70 sm:inline">
                      Searching...
                    </span>
                  )}

                  {searchStatus ===
                    "analyzing" && (
                    <span className="hidden text-[10px] text-violet-300/70 sm:inline">
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
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.08)] transition hover:scale-105 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
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
              Quantum can make mistakes. Verify
              important information.
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
    <div className="flex min-h-full w-full items-center">
      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">

        {/* CORE */}

        <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-400/10 blur-2xl" />

          <div className="absolute h-16 w-16 rounded-full border border-cyan-300/20 animate-[spin_10s_linear_infinite]" />

          <div className="absolute h-20 w-20 rounded-full border border-violet-400/10 animate-[spin_16s_linear_infinite_reverse]" />

          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.12] to-violet-500/[0.12] shadow-[0_0_50px_rgba(34,211,238,0.12)]">
            <Sparkles className="h-6 w-6 text-cyan-200" />
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Real-time AI research assistant
        </p>

        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-6xl">
          Whats on your mind,{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">
            {firstName}
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">
          Search the live web, explore complex
          information, and get synthesized answers
          without juggling dozens of browser tabs.
        </p>

        {/* PROMPTS */}

        <div className="mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
          <Prompt
            label="LIVE RESEARCH"
            text="What's happening in AI today?"
            onClick={() =>
              setMessage(
                "What's happening in AI today?"
              )
            }
          />

          <Prompt
            label="WEB ANALYSIS"
            text="Research the latest web development trends."
            onClick={() =>
              setMessage(
                "Research the latest web development trends."
              )
            }
          />

          <Prompt
            label="LEARN"
            text="Explain quantum computing simply."
            onClick={() =>
              setMessage(
                "Explain quantum computing simply."
              )
            }
          />

          <Prompt
            label="COMPARE"
            text="Compare Next.js with other frameworks."
            onClick={() =>
              setMessage(
                "Compare Next.js with other frameworks."
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MESSAGE BUBBLE
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
  copiedMessage: number | null;
  copiedCode: string | null;
  copyAnswer: (
    content: string,
    index: number
  ) => void;
  copyCode: (
    code: string,
    codeId: string
  ) => void;
}) {
  /* USER MESSAGE */

  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md border border-white/[0.08] bg-white/[0.055] px-5 py-3.5 text-[14px] leading-7 text-slate-200 shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:px-6">
          {item.content}
        </div>
      </div>
    );
  }

  /* ASSISTANT */

  return (
    <div className="w-full">
      {/* IDENTITY */}

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07]">
          <div className="absolute inset-0 rounded-xl bg-cyan-300/10 blur-md" />

          <Sparkles className="relative h-4 w-4 text-cyan-300" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.15em] text-cyan-300">
            QUANTUM
          </span>

          {item.research &&
            item.research.length >
              0 && (
              <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.025] px-2 py-1 text-[9px] text-cyan-300/60">
                WEB RESEARCH
              </span>
            )}
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

      {/* ANSWER */}

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] shadow-[0_18px_70px_rgba(0,0,0,0.12)]">

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
            <SearchProgress
              status="analyzing"
            />
          )}
        </div>

        {/* SOURCES */}

        {item.sources &&
          item.sources.length >
            0 && (
            <div className="border-t border-white/[0.07] px-5 py-5 sm:px-6">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                Sources
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {item.sources.map(
                  (
                    source,
                    sourceIndex
                  ) => (
                    <a
                      key={`${source.url}-${sourceIndex}`}
                      href={
                        source.url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 transition hover:border-cyan-300/15 hover:bg-white/[0.03]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                        <Globe2 className="h-3.5 w-3.5 text-cyan-300/80" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-400 group-hover:text-white">
                          {
                            source.title
                          }
                        </p>

                        <p className="mt-0.5 truncate text-[10px] text-slate-700">
                          {
                            source.url
                          }
                        </p>
                      </div>

                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-700 group-hover:text-cyan-300" />
                    </a>
                  )
                )}
              </div>
            </div>
          )}

        {/* COPY ANSWER */}

        {item.content && (
          <div className="flex justify-end border-t border-white/[0.05] px-5 py-2 sm:px-6">
            <button
              type="button"
              onClick={() =>
                copyAnswer(
                  item.content,
                  index
                )
              }
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 transition hover:bg-white/[0.04] hover:text-slate-400"
            >
              {copiedMessage ===
              index ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
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
  copiedCode: string | null;
  copyCode: (
    code: string,
    codeId: string
  ) => void;
}) {
  return (
    <div
      className="quantum-markdown overflow-x-auto text-[15px] leading-7 text-slate-300
        prose
        prose-invert
        max-w-none

        prose-headings:font-semibold
        prose-headings:text-white

        prose-p:text-slate-300

        prose-strong:text-white

        prose-a:text-cyan-300

        prose-li:text-slate-300

        prose-blockquote:border-cyan-300/30
        prose-blockquote:text-slate-500

        prose-hr:border-white/10

        prose-table:text-slate-300

        prose-th:border-white/[0.07]
        prose-th:bg-white/[0.04]
        prose-th:text-slate-200

        prose-td:border-white/[0.06]
        prose-td:text-slate-400

        prose-pre:bg-transparent
      "
    >
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
        ]}
        components={{
          /* ============================================
             CODE
          ============================================ */

          pre({
            children,
          }) {
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
              match?.[1] || "code";

            const code =
              String(
                child?.props?.children ||
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
              <div className="my-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#030712] shadow-[0_15px_50px_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400/60" />

                    <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-slate-600">
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
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
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
                  <pre className="m-0 bg-transparent p-0 font-mono text-[13px] leading-6 text-slate-300">
                    <code>{code}</code>
                  </pre>
                </div>
              </div>
            );
          },

          /* ============================================
             INLINE CODE
          ============================================ */

          code({
            children,
          }) {
            return (
              <code>
                {children}
              </code>
            );
          },

          /* ============================================
             LINKS
          ============================================ */

          a({
            children,
            href,
          }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },

          /* ============================================
             TABLES
          ============================================ */

          table({
            children,
          }) {
            return (
              <div className="quantum-scroll my-6 overflow-x-auto rounded-xl border border-white/[0.07]">
                <table className="m-0 min-w-[620px]">
                  {children}
                </table>
              </div>
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
   RESEARCH PANEL
========================================================= */

function ResearchPanel({
  results,
}: {
  results: ResearchResult[];
}) {
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-300/[0.10] bg-cyan-300/[0.025]">
      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-cyan-300/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300/[0.06]">
            <Globe2 className="h-3.5 w-3.5 text-cyan-300" />
          </div>

          <div>
            <p className="text-xs font-medium text-cyan-200">
              Live web research
            </p>

            <p className="text-[10px] text-slate-700">
              Current sources found by Quantum
            </p>
          </div>
        </div>

        <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] text-slate-600">
          {results.length} sources
        </span>
      </div>

      {/* RESULTS */}

      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {results.map(
          (result, index) => (
            <a
              key={`${result.url}-${index}`}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-white/[0.06] bg-black/20 p-3 transition hover:border-cyan-300/15 hover:bg-white/[0.03]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] font-semibold text-cyan-300">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-medium leading-5 text-slate-300 group-hover:text-white">
                    {result.title}
                  </p>

                  {result.content && (
                    <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-600">
                      {result.content}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <span className="truncate text-[9px] text-slate-700">
                      {getHostname(
                        result.url
                      )}
                    </span>

                    {typeof result.score ===
                      "number" && (
                      <span className="shrink-0 text-[9px] text-cyan-300/30">
                        {Math.round(
                          result.score * 100
                        )}
                        %
                      </span>
                    )}
                  </div>
                </div>

                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-700 transition group-hover:text-cyan-300" />
              </div>
            </a>
          )
        )}
      </div>
    </div>
  );
}

/* =========================================================
   HOSTNAME
========================================================= */

function getHostname(
  url: string
) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/* =========================================================
   PROMPT CARD
========================================================= */

function Prompt({
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
      className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/15 hover:bg-white/[0.045]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-semibold tracking-[0.2em] text-slate-700 transition group-hover:text-cyan-400/60">
          {label}
        </span>

        <Sparkles className="h-3.5 w-3.5 text-slate-700 transition group-hover:text-cyan-300" />
      </div>

      <p className="text-sm leading-6 text-slate-400 transition group-hover:text-slate-200">
        {text}
      </p>
    </button>
  );
}

/* =========================================================
   SEARCH STATUS
========================================================= */

function SearchProgress({
  status,
}: {
  status: SearchStatus;
}) {
  if (status === "searching") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />

        Searching the live web...
      </div>
    );
  }

  if (status === "analyzing") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-violet-300/10 bg-violet-300/[0.025] p-4 text-sm text-slate-400">
        <Sparkles className="h-4 w-4 animate-pulse text-cyan-300" />

        Quantum is synthesizing the research...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-300/10 bg-red-300/[0.025] p-4 text-sm text-red-300">
        Quantum encountered an error.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" />
      </div>

      Quantum is thinking...
    </div>
  );
}
