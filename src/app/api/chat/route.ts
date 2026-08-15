import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

import { groq, QUANTUM_MODEL } from "@/lib/groq";
import clientPromise from "@/lib/mongodb";

import { researchWeb } from "@/lib/web-research";
import { shouldSearch } from "@/lib/search-decision";

import {
  DEFAULT_QUANTUM_SETTINGS,
  sanitizeQuantumSettings,
  type QuantumSettings,
} from "@/lib/quantum-settings";

import {
  buildQuantumSystemPrompt,
} from "@/lib/quantum-system-prompt";

import {
  generateConversationTitle,
} from "@/lib/generate-title";

export const runtime = "nodejs";

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_CHARS = 1400;

const MAX_RESEARCH_RESULTS = 5;
const MAX_RESEARCH_CHARS = 700;
const MAX_PAGE_CHARS = 5000;

/* =========================================================
   HEALTH CHECK
========================================================= */

export async function GET() {
  return Response.json({
    ok: true,
    service: "Quantum Chat API",
    methods: ["GET", "POST"],
    model: QUANTUM_MODEL,
    timestamp: new Date().toISOString(),
  });
}

/* =========================================================
   SETTINGS
========================================================= */

async function getUserSettings(
  userId: string
) {
  try {
    const client = await clientPromise;

    const db = client.db(
      process.env.MONGODB_DB || "quantum"
    );

    const settings = await db
      .collection("userSettings")
      .findOne({ userId });

    if (!settings) {
      return DEFAULT_QUANTUM_SETTINGS;
    }

    return sanitizeQuantumSettings(
      settings as Partial<QuantumSettings>
    );
  } catch (error) {
    console.error(
      "QUANTUM SETTINGS ERROR:",
      error
    );

    return DEFAULT_QUANTUM_SETTINGS;
  }
}

/* =========================================================
   HISTORY
========================================================= */

function buildHistory(
  history: ClientMessage[],
  compact = false
) {
  const messageLimit = compact
    ? 2
    : MAX_HISTORY_MESSAGES;

  const characterLimit = compact
    ? 800
    : MAX_HISTORY_CHARS;

  return history
    .filter(
      (item) =>
        item.role === "user" ||
        item.role === "assistant"
    )
    .slice(-messageLimit)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(
        0,
        characterLimit
      ),
    }));
}

/* =========================================================
   RESEARCH CONTEXT
========================================================= */

function buildResearchContext(
  results: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>,
  extractedContent?: string,
  compact = false
) {
  const resultCount = compact
    ? 2
    : MAX_RESEARCH_RESULTS;

  const contentLimit = compact
    ? 450
    : MAX_RESEARCH_CHARS;

  const sources = results
    .slice(0, resultCount)
    .map(
      (result, index) => `
SOURCE ${index + 1}

TITLE:
${result.title || ""}

URL:
${result.url || ""}

CONTENT:
${(result.content || "").slice(
  0,
  contentLimit
)}
`
    )
    .join("\n");

  const page = extractedContent
    ? `

DIRECT PAGE CONTENT:

${extractedContent.slice(
  0,
  compact ? 2500 : MAX_PAGE_CHARS
)}
`
    : "";

  return sources + page;
}

/* =========================================================
   GROQ
========================================================= */

async function createGroqStream(
  messages: Array<{
    role:
      | "system"
      | "user"
      | "assistant";
    content: string;
  }>
) {
  return groq.chat.completions.create({
    model: QUANTUM_MODEL,

    messages,

    stream: true,

    temperature: 0.25,

    max_completion_tokens: 4000,
  });
}

/* =========================================================
   ERROR DETECTION
========================================================= */

function isOversizeError(
  error: unknown
) {
  const text =
    error instanceof Error
      ? error.message
      : String(error);

  const lower =
    text.toLowerCase();

  return (
    lower.includes("request too large") ||
    lower.includes("too many tokens") ||
    lower.includes("token limit") ||
    lower.includes("context")
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  const encoder = new TextEncoder();

  const sendEvent = (
    controller: ReadableStreamDefaultController,
    payload: unknown
  ) => {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify(
          payload
        )}\n\n`
      )
    );
  };

  try {
    /* =====================================================
       AUTH
    ===================================================== */

    const {
      isAuthenticated,
      userId,
    } = await auth();

    if (!isAuthenticated || !userId) {
      return Response.json(
        {
          error:
            "Unauthorized. Please sign in.",
        },
        {
          status: 401,
        }
      );
    }

    /* =====================================================
       BODY
    ===================================================== */

    let body: {
      message?: string;
      conversationId?: string | null;
      history?: ClientMessage[];
    };

    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error:
            "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    const message =
      String(body.message || "").trim();

    const conversationId =
      body.conversationId || null;

    const history = Array.isArray(
      body.history
    )
      ? body.history
      : [];

    if (!message) {
      return Response.json(
        {
          error:
            "Message is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       USER SETTINGS
    ===================================================== */

    const settings =
      await getUserSettings(
        userId
      );

    /* =====================================================
       SEARCH DECISION
    ===================================================== */

    const automaticSearch =
      shouldSearch(message);

    let needsSearch =
      automaticSearch;

    if (
      settings.searchMode ===
      "never"
    ) {
      needsSearch = false;
    }

    /*
     * "always" means all substantive messages
     * are searched. Greetings still remain local.
     */
    if (
      settings.searchMode ===
      "always"
    ) {
      needsSearch =
        automaticSearch;
    }

    /* =====================================================
       STREAM
    ===================================================== */

    const stream =
      new ReadableStream({
        async start(
          controller
        ) {
          let fullAnswer = "";

          let researchData:
            | Awaited<
                ReturnType<
                  typeof researchWeb
                >
              >
            | null = null;

          try {
            /* =============================================
               INITIAL STATUS
            ============================================= */

            sendEvent(
              controller,
              {
                type: "status",
                status: needsSearch
                  ? "searching"
                  : "thinking",
              }
            );

            /* =============================================
               TAVILY
            ============================================= */

            if (needsSearch) {
              try {
                researchData =
                  await researchWeb(
                    message
                  );

                sendEvent(
                  controller,
                  {
                    type: "research",

                    results:
                      settings.showResearch
                        ? researchData.results
                        : [],

                    pageUrl:
                      researchData.pageUrl,

                    isYouTube:
                      researchData.isYouTube,
                  }
                );

                sendEvent(
                  controller,
                  {
                    type: "status",
                    status: "analyzing",
                  }
                );
              } catch (error) {
                console.error(
                  "TAVILY ERROR:",
                  error
                );

                /*
                 * Search failure should not kill
                 * the entire AI request.
                 */

                researchData = null;

                sendEvent(
                  controller,
                  {
                    type: "status",
                    status: "thinking",
                  }
                );
              }
            }

            /* =============================================
               SYSTEM PROMPT
            ============================================= */

            const systemPrompt =
              buildQuantumSystemPrompt({
                currentDate:
                  new Date()
                    .toISOString()
                    .slice(0, 10),

                settings,
              });

            /* =============================================
               USER PROMPT
            ============================================= */

            let userPrompt = message;

            if (researchData) {
              const researchContext =
                buildResearchContext(
                  researchData.results,
                  researchData.extractedContent
                );

              userPrompt = `
USER REQUEST:

${message}

LIVE WEB RESEARCH:

${researchContext}

Use the supplied research where relevant.

Cite useful sources as [1], [2], [3].

Do not invent information that is not supported
by the supplied research.
`;
            }

            /* =============================================
               MODEL MESSAGES
            ============================================= */

            let modelMessages = [
              {
                role:
                  "system" as const,

                content:
                  systemPrompt,
              },

              ...buildHistory(history),

              {
                role:
                  "user" as const,

                content:
                  userPrompt,
              },
            ];

            /* =============================================
               GROQ REQUEST
            ============================================= */

            let groqStream;

            try {
              groqStream =
                await createGroqStream(
                  modelMessages
                );
            } catch (firstError) {
              /*
               * Automatically retry with a smaller
               * context if the request itself is too big.
               */

              if (
                !isOversizeError(
                  firstError
                )
              ) {
                throw firstError;
              }

              console.warn(
                "Quantum context was too large; retrying compact."
              );

              const compactResearch =
                researchData
                  ? buildResearchContext(
                      researchData.results,
                      researchData.extractedContent,
                      true
                    )
                  : "";

              const compactPrompt =
                researchData
                  ? `
USER REQUEST:

${message}

COMPACT RESEARCH:

${compactResearch}

Give a complete but focused answer.
`
                  : message;

              modelMessages = [
                {
                  role:
                    "system",

                  content:
                    systemPrompt,
                },

                ...buildHistory(
                  history,
                  true
                ),

                {
                  role:
                    "user",

                  content:
                    compactPrompt,
                },
              ];

              try {
                groqStream =
                  await createGroqStream(
                    modelMessages
                  );
              } catch (
                secondError
              ) {
                const errorText =
                  secondError instanceof
                  Error
                    ? secondError.message
                    : String(
                        secondError
                      );

                if (
                  errorText.includes(
                    "tokens per minute"
                  ) ||
                  errorText.includes(
                    "rate_limit_exceeded"
                  )
                ) {
                  throw new Error(
                    "Quantum has reached the current Groq token limit. Please try again shortly."
                  );
                }

                throw secondError;
              }
            }

            /* =============================================
               STREAM ANSWER
            ============================================= */

            for await (
              const chunk of groqStream
            ) {
              const text =
                chunk.choices[0]
                  ?.delta
                  ?.content || "";

              if (!text) {
                continue;
              }

              fullAnswer += text;

              sendEvent(
                controller,
                {
                  type: "chunk",
                  text,
                }
              );
            }

            /* =============================================
               MONGODB
            ============================================= */

            const client =
              await clientPromise;

            const db = client.db(
              process.env.MONGODB_DB ||
                "quantum"
            );

            const researchItems =
              researchData
                ?.results || [];

            const allSources =
              researchItems.map(
                (result) => ({
                  title:
                    result.title,

                  url:
                    result.url,

                  favicon:
                    result.favicon,
                })
              );

            const sources =
              settings.showSources
                ? allSources
                : [];

            const userMessage = {
              role: "user",
              content: message,
              createdAt: new Date(),
            };

            const assistantMessage = {
              role: "assistant",
              content: fullAnswer,
              sources,
              research: researchItems,
              createdAt: new Date(),
            };

            let savedConversationId =
              conversationId;

            /* =============================================
               EXISTING CHAT
            ============================================= */

            if (conversationId) {
              if (
                !ObjectId.isValid(
                  conversationId
                )
              ) {
                throw new Error(
                  "Invalid conversation ID."
                );
              }

              const update =
                await db
                  .collection(
                    "conversations"
                  )
                  .updateOne(
                    {
                      _id:
                        new ObjectId(
                          conversationId
                        ),

                      userId,
                    },

                    {
                      $push: {
                        messages: {
                          $each: [
                            userMessage,
                            assistantMessage,
                          ],
                        },
                      } as any,

                      $set: {
                        updatedAt:
                          new Date(),
                      },
                    }
                  );

              if (
                update.matchedCount ===
                0
              ) {
                throw new Error(
                  "Conversation not found."
                );
              }
            } else {
              /* ===========================================
                 NEW CHAT
              =========================================== */

              const title =
                await generateConversationTitle(
                  {
                    userMessage:
                      message,

                    assistantAnswer:
                      fullAnswer,
                  }
                );

              const created =
                await db
                  .collection(
                    "conversations"
                  )
                  .insertOne({
                    userId,

                    title,

                    messages: [
                      userMessage,
                      assistantMessage,
                    ],

                    createdAt:
                      new Date(),

                    updatedAt:
                      new Date(),
                  });

              savedConversationId =
                created.insertedId.toString();
            }

            /* =============================================
               COMPLETE
            ============================================= */

            sendEvent(
              controller,
              {
                type: "done",

                conversationId:
                  savedConversationId,

                searched:
                  needsSearch,

                sources,
              }
            );

            controller.close();
          } catch (error) {
            console.error(
              "QUANTUM STREAM ERROR:",
              error
            );

            sendEvent(
              controller,
              {
                type: "error",

                error:
                  error instanceof
                    Error
                    ? error.message
                    : "Quantum failed.",
              }
            );

            controller.close();
          }
        },
      });

    return new Response(
      stream,
      {
        headers: {
          "Content-Type":
            "text/event-stream; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          Connection:
            "keep-alive",

          "X-Accel-Buffering":
            "no",
        },
      }
    );
  } catch (error) {
    console.error(
      "QUANTUM API ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Quantum failed.",
      },
      {
        status: 500,
      }
    );
  }
}