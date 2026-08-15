import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

import { groq } from "@/lib/groq";
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

export const runtime = "nodejs";

interface ClientMessage {
  role:
    | "user"
    | "assistant";
  content: string;
}

function compactResearch(
  results: ResearchItem[],
  extractedContent?: string
) {
  const resultText =
    results
      .slice(0, 6)
      .map(
        (result, index) => `
SOURCE ${index + 1}

Title:
${result.title}

URL:
${result.url}

Content:
${(result.content || "").slice(
  0,
  1400
)}
`
      )
      .join("\n\n");

  const pageText =
    extractedContent
      ? `

DIRECT PAGE CONTENT:

${extractedContent.slice(
  0,
  7000
)}
`
      : "";

  return (
    resultText +
    pageText
  );
}

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
    /*
     * ==========================================
     * AUTH
     * ==========================================
     */

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

    /*
     * ==========================================
     * BODY
     * ==========================================
     */

    const body =
      await request.json();

    const message =
      String(
        body.message || ""
      ).trim();

    const conversationId =
      body.conversationId ||
      null;

    const history =
      (body.history ||
        []) as ClientMessage[];

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

    /*
     * ==========================================
     * SEARCH DECISION
     * ==========================================
     */

    const needsSearch =
      shouldSearch(message);

    /*
     * ==========================================
     * STREAM
     * ==========================================
     */

    const stream =
      new ReadableStream({
        async start(
          controller
        ) {
          let fullAnswer = "";

          let researchData =
            null as
              | Awaited<
                  ReturnType<
                    typeof researchWeb
                  >
                >
              | null;

          try {
            /*
             * ========================================
             * IMMEDIATE STATUS
             * ========================================
             */

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

            /*
             * ========================================
             * WEB RESEARCH
             * ========================================
             */

            if (needsSearch) {
              researchData =
                await researchWeb(
                  message
                );

              /*
               * Show research BEFORE Groq
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

              /*
               * ========================================
               * ANALYZING
               * ========================================
               */

              sendEvent(
                controller,
                {
                  type: "status",
                  status:
                    "analyzing",
                }
              );
            }

            /*
             * ========================================
             * CONTEXT
             * ========================================
             */

            const previousMessages =
              history
                .slice(-8)
                .map(
                  (item) => ({
                    role:
                      item.role,
                    content:
                      item.content.slice(
                        0,
                        4000
                      ),
                  })
                );

            /*
             * ========================================
             * CURRENT DATE
             * ========================================
             */

            const currentDate =
              new Date()
                .toISOString()
                .slice(0, 10);

            /*
             * ========================================
             * SYSTEM PROMPT
             * ========================================
             */

            const systemPrompt = `
You are Quantum AI.

Current date:
${currentDate}

You are a fast, current, research-oriented AI assistant.

RULES:

1. Use supplied web research whenever it exists.
2. Do not pretend you searched if no research exists.
3. Never invent URLs or sources.
4. Distinguish facts from inference.
5. Prefer current web evidence over stale model knowledge.
6. Maintain conversation context.
7. Use clear Markdown formatting.
8. Use headings when useful.
9. Use bullet lists when useful.
10. Use comparison tables when useful.
11. Use fenced code blocks for code.
12. Keep answers direct but sufficiently detailed.
13. When sources are supplied, reference them with [1], [2], [3] where appropriate.
14. If a supplied page is a YouTube page, do not claim to have watched or transcribed the video unless the supplied page content actually contains that information.
`;

            /*
             * ========================================
             * USER PROMPT
             * ========================================
             */

            let userPrompt =
              message;

            if (
              researchData
            ) {
              userPrompt = `
USER REQUEST:

${message}

LIVE WEB RESEARCH:

${compactResearch(
  researchData.results,
  researchData.extractedContent
)}

Answer the user's request using the supplied research.

If the research is about a specific page or URL,
prioritize that page.

If sources conflict, explain the conflict instead
of silently choosing one.

Use [1], [2], etc. when citing supplied sources.
`;
            }

            /*
             * ========================================
             * GROQ
             * ========================================
             */

            const groqMessages = [
              {
                role:
                  "system" as const,
                content:
                  systemPrompt,
              },

              ...previousMessages,

              {
                role:
                  "user" as const,
                content:
                  userPrompt,
              },
            ];

            const groqStream =
              await groq.chat.completions.create(
                {
                  model:
                    "llama-3.1-8b-instant",

                  messages:
                    groqMessages,

                  stream: true,

                  temperature: 0.25,

                  max_tokens: 2200,
                }
              );

            /*
             * ========================================
             * STREAM
             * ========================================
             */

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

            /*
             * ========================================
             * MONGODB
             * ========================================
             */

            const client =
              await clientPromise;

            const db =
              client.db(
                process.env.MONGODB_DB ||
                  "quantum"
              );

            const sources =
              researchData?.results
                ?.map(
                  (
                    result
                  ) => ({
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
                  researchData
                    ?.results ||
                  [],
                createdAt:
                  new Date(),
              };

            let savedConversationId =
              conversationId;

            /*
             * ========================================
             * EXISTING CHAT
             * ========================================
             */

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
              /*
               * ======================================
               * NEW CHAT
               * ======================================
               */

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

            /*
             * ========================================
             * DONE
             * ========================================
             */

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