import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

import {
  groq,
  QUANTUM_MODEL,
} from "@/lib/groq";

import clientPromise from "@/lib/mongodb";

import {
  researchWeb,
} from "@/lib/web-research";

import {
  shouldSearch,
} from "@/lib/search-decision";

import {
  DEFAULT_QUANTUM_SETTINGS,
  sanitizeQuantumSettings,
} from "@/lib/quantum-settings";

import {
  buildQuantumSystemPrompt,
} from "@/lib/quantum-system-prompt";

import {
  generateConversationTitle,
} from "@/lib/generate-title";

import {
  buildFileContext,
  extractFile,
  MAX_FILES_PER_REQUEST,
  type ExtractedFile,
} from "@/lib/file-extractor";

export const runtime = "nodejs";

/* =========================================================
   TYPES
========================================================= */

interface ClientMessage {
  role:
    | "user"
    | "assistant";

  content: string;
}

interface ParsedRequest {
  message: string;
  conversationId: string | null;
  history: ClientMessage[];
  files: File[];
}

/* =========================================================
   LIMITS
========================================================= */

const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_CHARS = 1400;

const MAX_RESEARCH_RESULTS = 3;
const MAX_RESEARCH_CHARS = 700;
const MAX_PAGE_CHARS = 4000;

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
    const client =
      await clientPromise;

    const db =
      client.db(
        process.env.MONGODB_DB ||
          "quantum"
      );

    const stored =
      await db
        .collection(
          "userSettings"
        )
        .findOne({
          userId,
        });

    if (!stored) {
      return DEFAULT_QUANTUM_SETTINGS;
    }

    return sanitizeQuantumSettings(
      stored as Partial<
        typeof DEFAULT_QUANTUM_SETTINGS
      >
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
  const count =
    compact
      ? 2
      : MAX_HISTORY_MESSAGES;

  const chars =
    compact
      ? 800
      : MAX_HISTORY_CHARS;

  return history
    .filter(
      (item) =>
        (item.role === "user" ||
          item.role === "assistant") &&
        typeof item.content ===
          "string"
    )
    .slice(-count)
    .map((item) => ({
      role: item.role,
      content:
        item.content.slice(
          0,
          chars
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
  const count =
    compact
      ? 2
      : MAX_RESEARCH_RESULTS;

  const chars =
    compact
      ? 450
      : MAX_RESEARCH_CHARS;

  const sources =
    results
      .slice(0, count)
      .map(
        (result, index) => `
SOURCE ${index + 1}

TITLE:
${result.title || ""}

URL:
${result.url || ""}

CONTENT:
${(
  result.content || ""
).slice(
  0,
  chars
)}
`
      )
      .join("\n");

  const page =
    extractedContent
      ? `

DIRECT PAGE CONTENT:

${extractedContent.slice(
  0,
  compact
    ? 2500
    : MAX_PAGE_CHARS
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
   OVERSIZE DETECTION
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
    lower.includes(
      "request too large"
    ) ||
    lower.includes(
      "too many tokens"
    ) ||
    lower.includes(
      "token limit"
    ) ||
    lower.includes(
      "context"
    )
  );
}

/* =========================================================
   RATE LIMIT DETECTION
========================================================= */

function isRateLimitError(
  error: unknown
) {
  const text =
    error instanceof Error
      ? error.message
      : String(error);

  const lower =
    text.toLowerCase();

  return (
    lower.includes(
      "rate_limit_exceeded"
    ) ||
    lower.includes(
      "tokens per minute"
    ) ||
    lower.includes(
      "too many requests"
    ) ||
    lower.includes(
      "429"
    )
  );
}

/* =========================================================
   PROVIDER ERROR MESSAGE
========================================================= */

function getProviderErrorMessage(
  error: unknown
) {
  const text =
    error instanceof Error
      ? error.message
      : String(error);

  const lower =
    text.toLowerCase();

  if (
    lower.includes(
      "access denied"
    ) &&
    lower.includes(
      "network settings"
    )
  ) {
    return (
      "Groq denied this network request. " +
      "This is a Groq/network access issue, not a file-reading error."
    );
  }

  if (isRateLimitError(error)) {
    return (
      "Quantum reached the current Groq rate limit. " +
      "Please try again shortly."
    );
  }

  if (isOversizeError(error)) {
    return (
      "The request was too large for the current Groq limit. " +
      "Quantum automatically reduced the context, but the request still exceeded the limit."
    );
  }

  return text || "Quantum failed.";
}

/* =========================================================
   PARSE REQUEST
========================================================= */

async function parseRequest(
  request: NextRequest
): Promise<ParsedRequest> {
  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  /* -------------------------------------------------------
     MULTIPART
  ------------------------------------------------------- */

  if (
    contentType.includes(
      "multipart/form-data"
    )
  ) {
    const formData =
      await request.formData();

    const message =
      String(
        formData.get("message") ||
          ""
      ).trim();

    const conversationIdRaw =
      String(
        formData.get(
          "conversationId"
        ) || ""
      ).trim();

    const conversationId =
      conversationIdRaw ||
      null;

    const historyRaw =
      String(
        formData.get("history") ||
          "[]"
      );

    let history: ClientMessage[] =
      [];

    try {
      const parsed =
        JSON.parse(
          historyRaw
        );

      if (
        Array.isArray(parsed)
      ) {
        history = parsed.filter(
          (item) =>
            item &&
            (item.role ===
              "user" ||
              item.role ===
                "assistant") &&
            typeof item.content ===
              "string"
        );
      }
    } catch {
      history = [];
    }

    const files =
      formData
        .getAll("files")
        .filter(
          (
            item
          ): item is File =>
            item instanceof File &&
            item.size > 0
        )
        .slice(
          0,
          MAX_FILES_PER_REQUEST
        );

    return {
      message,
      conversationId,
      history,
      files,
    };
  }

  /* -------------------------------------------------------
     JSON
  ------------------------------------------------------- */

  const body =
    await request.json();

  const history =
    Array.isArray(
      body?.history
    )
      ? body.history.filter(
          (item: unknown) => {
            if (
              !item ||
              typeof item !==
                "object"
            ) {
              return false;
            }

            const value =
              item as Record<
                string,
                unknown
              >;

            return (
              (value.role ===
                "user" ||
                value.role ===
                  "assistant") &&
              typeof value.content ===
                "string"
            );
          }
        )
      : [];

  return {
    message:
      String(
        body?.message || ""
      ).trim(),

    conversationId:
      typeof body?.conversationId ===
      "string"
        ? body.conversationId
        : null,

    history,

    files: [],
  };
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  const encoder =
    new TextEncoder();

  const sendEvent = (
    controller:
      ReadableStreamDefaultController,
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

    if (
      !isAuthenticated ||
      !userId
    ) {
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
       PARSE
    ===================================================== */

    let parsed: ParsedRequest;

    try {
      parsed =
        await parseRequest(
          request
        );
    } catch (error) {
      console.error(
        "REQUEST PARSE ERROR:",
        error
      );

      return Response.json(
        {
          error:
            "Quantum could not read this request.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      message,
      conversationId,
      history,
      files,
    } = parsed;

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
       VALIDATE CONVERSATION ID
    ===================================================== */

    if (
      conversationId &&
      !ObjectId.isValid(
        conversationId
      )
    ) {
      return Response.json(
        {
          error:
            "Invalid conversation ID.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       SETTINGS
    ===================================================== */

    const settings =
      await getUserSettings(
        userId
      );

    /* =====================================================
       FILE EXTRACTION
    ===================================================== */

    const extractedFiles: ExtractedFile[] =
      [];

    const fileErrors: Array<{
      name: string;
      error: string;
    }> = [];

    for (
      const file of files
    ) {
      try {
        const extracted =
          await extractFile(
            file
          );

        extractedFiles.push(
          extracted
        );
      } catch (error) {
        console.error(
          `FILE EXTRACTION ERROR: ${file.name}`,
          error
        );

        fileErrors.push({
          name:
            file.name,

          error:
            error instanceof
            Error
              ? error.message
              : "Could not read file.",
        });
      }
    }

    const hasFiles =
      extractedFiles.length >
      0;

    const fileContext =
      hasFiles
        ? buildFileContext(
            extractedFiles
          )
        : "";

    /* =====================================================
       SEARCH
    ===================================================== */

    const automaticSearch =
      shouldSearch(
        message
      );

    const needsSearch =
      settings.searchMode ===
      "never"
        ? false
        : automaticSearch;

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
               FILE STATUS
            ============================================= */

            if (
              hasFiles ||
              fileErrors.length
            ) {
              sendEvent(
                controller,
                {
                  type:
                    "files",

                  files:
                    extractedFiles.map(
                      (
                        file
                      ) => ({
                        name:
                          file.name,

                        size:
                          file.size,

                        type:
                          file.type,

                        truncated:
                          file.truncated,
                      })
                    ),

                  errors:
                    fileErrors,
                }
              );
            }

            /* =============================================
               STATUS
            ============================================= */

            sendEvent(
              controller,
              {
                type:
                  "status",

                status:
                  needsSearch
                    ? "searching"
                    : hasFiles
                    ? "analyzing-files"
                    : "thinking",
              }
            );

            /* =============================================
               WEB RESEARCH
            ============================================= */

            if (
              needsSearch
            ) {
              try {
                researchData =
                  await researchWeb(
                    message
                  );

                sendEvent(
                  controller,
                  {
                    type:
                      "research",

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
                    type:
                      "status",

                    status:
                      hasFiles
                        ? "analyzing-files"
                        : "analyzing",
                  }
                );
              } catch (error) {
                console.error(
                  "TAVILY ERROR:",
                  error
                );

                researchData =
                  null;
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

            let userPrompt =
              message;

            if (hasFiles) {
              userPrompt += `

ATTACHED FILES:

${fileContext}

Use the attached files as primary source material
for file-related questions.

Do not invent information that is not present in
the supplied file content.

If the file was truncated, acknowledge that when
it materially affects the answer.
`;
            }

            if (researchData) {
              const researchContext =
                buildResearchContext(
                  researchData.results,
                  researchData.extractedContent
                );

              userPrompt += `

LIVE WEB RESEARCH:

${researchContext}

Use the supplied research when useful.

Cite relevant sources as [1], [2], [3].

Do not invent unsupported information.
`;
            }

            /* =============================================
               MODEL MESSAGES
            ============================================= */

            let modelMessages =
              [
                {
                  role:
                    "system" as const,

                  content:
                    systemPrompt,
                },

                ...buildHistory(
                  history
                ),

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
              console.error(
                "INITIAL GROQ ERROR:",
                firstError
              );

              if (
                !isOversizeError(
                  firstError
                )
              ) {
                throw firstError;
              }

              /* -------------------------------------------
                 COMPACT RETRY
              ------------------------------------------- */

              const compactResearch =
                researchData
                  ? buildResearchContext(
                      researchData.results,
                      researchData.extractedContent,
                      true
                    )
                  : "";

              const compactFiles =
                extractedFiles
                  .map(
                    (file) => `
FILE:
${file.name}

CONTENT:
${file.text.slice(
  0,
  2500
)}
`
                  )
                  .join("\n");

              const compactPrompt = `
USER REQUEST:

${message}

${
  compactFiles
    ? `
ATTACHED FILES:

${compactFiles}
`
    : ""
}

${
  compactResearch
    ? `
LIVE RESEARCH:

${compactResearch}
`
    : ""
}

Give a complete but focused answer.
`;

              modelMessages =
                [
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
                console.error(
                  "COMPACT GROQ ERROR:",
                  secondError
                );

                throw secondError;
              }
            }

            /* =============================================
               STREAM
            ============================================= */

            for await (
              const chunk of
                groqStream
            ) {
              const text =
                chunk
                  .choices[0]
                  ?.delta
                  ?.content ||
                "";

              if (!text) {
                continue;
              }

              fullAnswer +=
                text;

              sendEvent(
                controller,
                {
                  type:
                    "chunk",

                  text,
                }
              );
            }

            /* =============================================
               MONGODB
            ============================================= */

            const client =
              await clientPromise;

            const db =
              client.db(
                process.env.MONGODB_DB ||
                  "quantum"
              );

            const researchItems =
              researchData?.results ||
              [];

            const sourceItems =
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
                ? sourceItems
                : [];

            const userMessage = {
              role: "user",

              content: message,

              attachments:
                extractedFiles.map(
                  (file) => ({
                    name:
                      file.name,

                    size:
                      file.size,

                    type:
                      file.type,

                    truncated:
                      file.truncated,
                  })
                ),

              createdAt:
                new Date(),
            };

            const assistantMessage = {
              role: "assistant",

              content: fullAnswer,

              sources,

              research:
                researchItems,

              createdAt:
                new Date(),
            };

            let savedConversationId =
              conversationId;

            /* =============================================
               SAVE EXISTING
            ============================================= */

            if (
              conversationId
            ) {
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
                        messages:
                          {
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
              /* =========================================
                 NEW CONVERSATION
              ========================================= */

              let title =
                "New Conversation";

              try {
                title =
                  await generateConversationTitle(
                    {
                      userMessage:
                        message,

                      assistantAnswer:
                        fullAnswer,
                    }
                  );
              } catch (error) {
                console.error(
                  "TITLE GENERATION ERROR:",
                  error
                );
              }

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
                type:
                  "done",

                conversationId:
                  savedConversationId,

                searched:
                  needsSearch,

                sources,

                files:
                  extractedFiles.map(
                    (file) => ({
                      name:
                        file.name,

                      size:
                        file.size,

                      type:
                        file.type,

                      truncated:
                        file.truncated,
                    })
                  ),
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
                type:
                  "error",

                error:
                  getProviderErrorMessage(
                    error
                  ),
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
          getProviderErrorMessage(
            error
          ),
      },
      {
        status: 500,
      }
    );
  }
}