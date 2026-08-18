import {
  NextRequest,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  auth,
} from "@clerk/nextjs/server";

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
  ExtractedFile,
  MAX_FILES_PER_REQUEST,
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

/* =========================================================
   LIMITS
========================================================= */

const MAX_HISTORY_MESSAGES = 4;

const MAX_HISTORY_CHARS = 1400;

const MAX_RESEARCH_RESULTS = 3;

const MAX_RESEARCH_CHARS = 700;

const MAX_PAGE_CHARS = 4000;

/* =========================================================
   GET HEALTH CHECK
========================================================= */

export async function GET() {
  return Response.json({
    ok: true,

    service:
      "Quantum Chat API",

    methods: [
      "GET",
      "POST",
    ],

    model:
      QUANTUM_MODEL,

    timestamp:
      new Date().toISOString(),
  });
}

/* =========================================================
   USER SETTINGS
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
      stored as unknown as Partial<typeof DEFAULT_QUANTUM_SETTINGS>
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
        item.role ===
          "user" ||
        item.role ===
          "assistant"
    )
    .slice(-count)
    .map(
      (item) => ({
        role:
          item.role,

        content:
          item.content.slice(
            0,
            chars
          ),
      })
    );
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
  result.content ||
  ""
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

  return (
    sources +
    page
  );
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
  return groq.chat.completions.create(
    {
      model:
        QUANTUM_MODEL,

      messages,

      stream: true,

      temperature:
        0.25,

      /*
       * Your requested maximum.
       */
      max_completion_tokens:
        3500,
    }
  );
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
   PARSE REQUEST
========================================================= */

async function parseRequest(
  request: NextRequest
) {
  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  /*
   * ==========================================
   * MULTIPART
   * ==========================================
   */

  if (
    contentType.includes(
      "multipart/form-data"
    )
  ) {
    const formData =
      await request.formData();

    const message =
      String(
        formData.get(
          "message"
        ) || ""
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

    let history: ClientMessage[] =
      [];

    const historyRaw =
      String(
        formData.get(
          "history"
        ) || "[]"
      );

    try {
      const parsed =
        JSON.parse(
          historyRaw
        );

      if (
        Array.isArray(parsed)
      ) {
        history = parsed;
      }
    } catch {
      history = [];
    }

    const uploadedFiles =
      formData
        .getAll("files")
        .filter(
          (
            item
          ): item is File =>
            item instanceof File &&
            item.size > 0
        );

    return {
      message,

      conversationId,

      history,

      files:
        uploadedFiles.slice(
          0,
          MAX_FILES_PER_REQUEST
        ),
    };
  }

  /*
   * ==========================================
   * JSON
   * ==========================================
   */

  const body =
    await request.json();

  return {
    message:
      String(
        body?.message || ""
      ).trim(),

    conversationId:
      body?.conversationId ||
      null,

    history:
      Array.isArray(
        body?.history
      )
        ? body.history
        : [],

    files:
      [] as File[],
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
    /* ==========================================
       AUTH
    ========================================== */

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

    /* ==========================================
       PARSE REQUEST
    ========================================== */

    let parsed;

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
            "Quantum could not read the request.",
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

    /* ==========================================
       SETTINGS
    ========================================== */

    const settings =
      await getUserSettings(
        userId
      );

    /* ==========================================
       FILE EXTRACTION
    ========================================== */

    const extractedFiles: ExtractedFile[] = [];

    const fileErrors: {
      name: string;
      error: string;
    }[] = [];

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

    const fileContext =
      buildFileContext(
        extractedFiles
      );

    const hasFiles =
      extractedFiles.length >
      0;

    /* ==========================================
       SEARCH
    ========================================== */

    const automaticSearch =
      shouldSearch(
        message
      );

    const needsSearch =
      settings.searchMode ===
      "never"
        ? false
        : automaticSearch;

    /* ==========================================
       STREAM
    ========================================== */

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
            /* ========================================
               FILE STATUS
            ======================================== */

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

            /* ========================================
               SEARCH STATUS
            ======================================== */

            sendEvent(
              controller,
              {
                type: "status",

                status:
                  needsSearch
                    ? "searching"
                    : hasFiles
                    ? "analyzing-files"
                    : "thinking",
              }
            );

            /* ========================================
               WEB RESEARCH
            ======================================== */

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
                    type: "status",

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

            /* ========================================
               SYSTEM
            ======================================== */

            const systemPrompt =
              buildQuantumSystemPrompt({
                currentDate:
                  new Date()
                    .toISOString()
                    .slice(0, 10),

                settings,
              });

            /* ========================================
               USER PROMPT
            ======================================== */

            let userPrompt =
              message;

            if (hasFiles) {
              userPrompt = `
USER REQUEST:

${message}

ATTACHED FILE CONTENT:

${fileContext}

Use the attached files as primary source material
for file-related questions.

Do not invent information that is not present in
the supplied file content.

If a file was truncated, acknowledge that limitation
when it matters.
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

Use the web research when relevant.

Cite useful sources as [1], [2], [3].

Do not invent facts that are not supported by
the supplied research.
`;
            }

            /* ========================================
               MODEL MESSAGES
            ======================================== */

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

            /* ========================================
               GROQ
            ======================================== */

            let groqStream;

            try {
              groqStream =
                await createGroqStream(
                  modelMessages
                );
            } catch (
              firstError
            ) {
              if (
                !isOversizeError(
                  firstError
                )
              ) {
                throw firstError;
              }

              /*
               * Compact retry.
               */

              const compactResearch =
                researchData
                  ? buildResearchContext(
                      researchData.results,
                      researchData.extractedContent,
                      true
                    )
                  : "";

              /*
               * Rebuild file context even smaller.
               */
              const compactFileContext =
                extractedFiles
                  .map(
                    (file) =>
                      `
FILE:
${file.name}

CONTENT:
${file.text.slice(
  0,
  2500
)}
`
                  )
                  .join(
                    "\n"
                  );

              const compactPrompt = `
USER REQUEST:

${message}

${
  compactFileContext
    ? `
ATTACHED FILES:

${compactFileContext}
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

            /* ========================================
               STREAM
            ======================================== */

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

            /* ========================================
               SAVE
            ======================================== */

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
              role:
                "user",

              content:
                message,

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

            const assistantMessage =
              {
                role:
                  "assistant",

                content:
                  fullAnswer,

                sources,

                research:
                  researchItems,

                createdAt:
                  new Date(),
              };

            let savedConversationId =
              conversationId;

            /* ========================================
               EXISTING CONVERSATION
            ======================================== */

            if (
              conversationId
            ) {
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
              /* ======================================
                 NEW CONVERSATION
              ====================================== */

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

            /* ========================================
               DONE
            ======================================== */

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
          error instanceof
          Error
            ? error.message
            : "Quantum failed.",
      },
      {
        status: 500,
      }
    );
  }
}