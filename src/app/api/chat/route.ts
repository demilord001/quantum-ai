import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";

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
  type ResearchItem,
} from "@/lib/web-research";

import {
  shouldSearch,
} from "@/lib/search-decision";

import {
  generateConversationTitle,
} from "@/lib/generate-title";

export const runtime =
  "nodejs";

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
   CONTEXT LIMITS
========================================================= */

/*
 * These are deliberately MUCH smaller than 131K.
 *
 * A big context window doesn't mean we should
 * fill it on every request.
 */

const HISTORY_MESSAGES = 6;

const HISTORY_CHARS_PER_MESSAGE = 2800;

const SEARCH_CHARS_PER_RESULT = 1100;

const MAX_RESEARCH_RESULTS = 6;

const MAX_PAGE_CHARS = 14000;

/* =========================================================
   ERROR DETECTION
========================================================= */

function isContextError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const text =
    message.toLowerCase();

  return (
    text.includes(
      "context"
    ) ||
    text.includes(
      "maximum context"
    ) ||
    text.includes(
      "too many tokens"
    ) ||
    text.includes(
      "token limit"
    ) ||
    text.includes(
      "max tokens"
    )
  );
}

/* =========================================================
   TEXT CLEANING
========================================================= */

function cleanText(
  text: string
) {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   RESEARCH COMPRESSION
========================================================= */

function buildResearchContext(
  results: ResearchItem[],
  extractedContent?: string,
  compact = false
) {
  const resultLimit =
    compact
      ? 3
      : MAX_RESEARCH_RESULTS;

  const resultCharacters =
    compact
      ? 700
      : SEARCH_CHARS_PER_RESULT;

  const resultText =
    results
      .slice(0, resultLimit)
      .map(
        (result, index) => `
SOURCE ${index + 1}

TITLE:
${cleanText(
  result.title
)}

URL:
${result.url}

CONTENT:
${cleanText(
  result.content || ""
).slice(
  0,
  resultCharacters
)}
`
      )
      .join("\n");

  const pageText =
    extractedContent
      ? `

DIRECT PAGE CONTENT:

${extractedContent.slice(
  0,
  compact
    ? 6000
    : MAX_PAGE_CHARS
)}
`
      : "";

  return (
    resultText +
    pageText
  );
}

/* =========================================================
   HISTORY COMPRESSION
========================================================= */

function buildHistory(
  history: ClientMessage[],
  compact = false
) {
  const messageLimit =
    compact
      ? 3
      : HISTORY_MESSAGES;

  const charLimit =
    compact
      ? 1500
      : HISTORY_CHARS_PER_MESSAGE;

  return history
    .filter(
      (message) =>
        message.role ===
          "user" ||
        message.role ===
          "assistant"
    )
    .slice(
      -messageLimit
    )
    .map(
      (message) => ({
        role:
          message.role,

        content:
          message.content.slice(
            0,
            charLimit
          ),
      })
    );
}

/* =========================================================
   SEND GROQ
========================================================= */

async function createGroqStream({
  messages,
}: {
  messages: Array<{
    role:
      | "system"
      | "user"
      | "assistant";

    content: string;
  }>;
}) {
  return groq.chat.completions.create(
    {
      model:
        QUANTUM_MODEL,

      messages,

      stream: true,

      temperature: 0.25,

      /*
       * Enough for a polished answer without
       * letting one request consume enormous
       * output.
       */

      max_completion_tokens:
        8192,
    }
  );
}

/* =========================================================
   MAIN ROUTE
========================================================= */

export async function POST(
  request: NextRequest
) {
  const encoder =
    new TextEncoder();

  const sendEvent = (
    controller:
      ReadableStreamDefaultController,
    data: unknown
  ) => {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify(
          data
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
      return new Response(
        JSON.stringify({
          error:
            "Unauthorized. Please sign in.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    /* =====================================================
       BODY
    ===================================================== */

    const body =
      await request.json();

    const message =
      String(
        body?.message || ""
      ).trim();

    const conversationId =
      body?.conversationId ||
      null;

    const history =
      Array.isArray(
        body?.history
      )
        ? (body.history as ClientMessage[])
        : [];

    if (!message) {
      return new Response(
        JSON.stringify({
          error:
            "Message is required.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    /* =====================================================
       SEARCH DECISION
    ===================================================== */

    const needsSearch =
      shouldSearch(message);

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
            /* =================================================
               IMMEDIATE UI STATUS
            ================================================= */

            sendEvent(
              controller,
              {
                type: "status",

                status:
                  needsSearch
                    ? "searching"
                    : "thinking",
              }
            );

            /* =================================================
               TAVILY
            ================================================= */

            if (needsSearch) {
              try {
                researchData =
                  await researchWeb(
                    message
                  );

                /*
                 * Research appears immediately
                 * in the Quantum UI.
                 */

                sendEvent(
                  controller,
                  {
                    type: "research",

                    results:
                      researchData.results,

                    pageUrl:
                      researchData.pageUrl,

                    isYouTube:
                      researchData.isYouTube,

                    researchType:
                      researchData.type,
                  }
                );

                sendEvent(
                  controller,
                  {
                    type: "status",
                    status:
                      "analyzing",
                  }
                );
              } catch (error) {
                /*
                 * Search failure does NOT kill the
                 * entire assistant.
                 *
                 * Quantum can still answer from
                 * model knowledge.
                 */

                console.error(
                  "TAVILY ERROR:",
                  error
                );

                researchData =
                  null;

                sendEvent(
                  controller,
                  {
                    type: "status",
                    status:
                      "thinking",
                  }
                );
              }
            }

            /* =================================================
               BUILD SYSTEM
            ================================================= */

            const currentDate =
              new Date()
                .toISOString()
                .slice(0, 10);

            const systemPrompt = `
You are Quantum AI.

CURRENT DATE:
${currentDate}

You are a premium AI research assistant.

RESPONSE FORMAT:

Always structure substantial answers like this:

## Clear Descriptive Title

Opening answer paragraph.

### Key points

- Important point
- Important point
- Important point

### Explanation

Explain the subject clearly in readable paragraphs.

Use additional headings when necessary.

Use comparison tables when helpful.

Use fenced code blocks for code.

Use bold text for important concepts.

Do not begin with:
"Sure!"
"Of course!"
"Certainly!"

Do not repeat the user's question unnecessarily.

You are powered by DemLabs Inc, CEO is Luis your creator. When ever you are asked.

For literary works, poems, essays, articles, or other provided text:
- analyze what is actually available;
- clearly distinguish quotation, interpretation, and inference;
- do not invent lines from the work.

For web research:
- use the supplied research;
- do not invent sources;
- cite supplied sources using [1], [2], etc. when appropriate;
- distinguish current facts from inference.

For URLs:
- use the extracted page content if supplied;
- do not claim to have watched a video unless the supplied information actually supports that claim.

Keep the response useful and readable.
`;

            /* =================================================
               USER PROMPT
            ================================================= */

            let userPrompt =
              message;

            if (researchData) {
              const researchContext =
                buildResearchContext(
                  researchData.results,
                  researchData.extractedContent
                );

              userPrompt = `
USER REQUEST:

${message}

LIVE RESEARCH:

<<<
${researchContext}
>>>

Use the supplied research to answer the user.

If the research contains incomplete information,
say so rather than inventing missing details.

Cite relevant sources as [1], [2], etc.
`;
            }

            /* =================================================
               INITIAL GROQ MESSAGES
            ================================================= */

            let previousMessages =
              buildHistory(
                history
              );

            let groqMessages: Array<{
              role:
                | "system"
                | "user"
                | "assistant";

              content: string;
            }> = [
              {
                role: "system",

                content:
                  systemPrompt,
              },

              ...previousMessages,

              {
                role: "user",

                content:
                  userPrompt,
              },
            ];

            /* =================================================
               GROQ
            ================================================= */

            let groqStream;

            try {
              groqStream =
                await createGroqStream(
                  {
                    messages:
                      groqMessages,
                  }
                );
            } catch (firstError) {
              /*
               * If context is too large, automatically
               * retry with a much smaller prompt.
               */

              if (
                !isContextError(
                  firstError
                )
              ) {
                throw firstError;
              }

              console.warn(
                "QUANTUM: context too large; retrying with compact context."
              );

              previousMessages =
                buildHistory(
                  history,
                  true
                );

              if (researchData) {
                const compactResearch =
                  buildResearchContext(
                    researchData.results,
                    researchData.extractedContent,
                    true
                  );

                userPrompt = `
USER REQUEST:

${message}

COMPACT LIVE RESEARCH:

${compactResearch}

Answer using only the information needed.
`;
              }

              groqMessages = [
                {
                  role:
                    "system",

                  content:
                    systemPrompt,
                },

                ...previousMessages,

                {
                  role:
                    "user",

                  content:
                    userPrompt,
                },
              ];

              groqStream =
                await createGroqStream(
                  {
                    messages:
                      groqMessages,
                  }
                );
            }

            /* =================================================
               STREAM ANSWER
            ================================================= */

            for await (
              const chunk of groqStream
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
                  type: "chunk",

                  text,
                }
              );
            }

            /* =================================================
               MONGODB
            ================================================= */

            const client =
              await clientPromise;

            const db =
              client.db(
                process.env.MONGODB_DB ||
                  "quantum"
              );

            const sources =
              researchData?.results?.map(
                (result) => ({
                  title:
                    result.title,

                  url:
                    result.url,

                  favicon:
                    result.favicon,
                })
              ) || [];

            const userMessage = {
              role: "user",
              content: message,
              createdAt:
                new Date(),
            };

            const assistantMessage =
              {
                role: "assistant",

                content:
                  fullAnswer,

                sources,

                research:
                  researchData?.results ||
                  [],

                createdAt:
                  new Date(),
              };

            let savedConversationId =
              conversationId;

            /* =================================================
               EXISTING CHAT
            ================================================= */

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

              const updated =
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
                updated.matchedCount ===
                0
              ) {
                throw new Error(
                  "Conversation not found."
                );
              }
            } else {
              /* ==============================================
                 NEW CHAT
              ============================================== */

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

            /* =================================================
               DONE
            ================================================= */

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

    return new Response(
      JSON.stringify({
        error:
          error instanceof
            Error
            ? error.message
            : "Quantum failed.",
      }),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }
}