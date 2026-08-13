import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@clerk/nextjs/server";

import { groq } from "@/lib/groq";
import { tvly } from "@/lib/tavily";
import { shouldSearch } from "@/lib/search-decision";
import clientPromise from "@/lib/mongodb";

import { generateConversationTitle } from "@/lib/generate-title";

export const runtime = "nodejs";

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

function compactResearch(results: any[]) {
  return results
    .slice(0, 5)
    .map(
      (result, index) => `
SOURCE ${index + 1}
Title: ${result.title}
URL: ${result.url}
Summary: ${(result.content || "").slice(0, 1600)}
`
    )
    .join("\n\n");
}

export async function POST(
  request: NextRequest
) {
  const encoder = new TextEncoder();

  const sendEvent = (
    controller: ReadableStreamDefaultController,
    data: unknown
  ) => {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify(data)}\n\n`
      )
    );
  };

  try {
    const {
      isAuthenticated,
      userId,
    } = await auth();

    if (!isAuthenticated || !userId) {
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

    const body =
      await request.json();

    const message =
      String(body.message || "").trim();

    const conversationId =
      body.conversationId || null;

    const history =
      (body.history as ClientMessage[]) || [];

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
     * Create the stream FIRST.
     *
     * This lets the browser immediately receive
     * "searching" instead of waiting for Tavily.
     */

    const stream =
      new ReadableStream({
        async start(controller) {
          let fullAnswer = "";

          try {
            const needsSearch =
              shouldSearch(message);

            let searchResults: any[] = [];

            /*
             * ==========================================
             * IMMEDIATE STATUS
             * ==========================================
             */

            sendEvent(
              controller,
              {
                type: "status",
                status: needsSearch
                  ? "searching"
                  : "thinking",
              }
            );

            /*
             * ==========================================
             * TAVILY
             * ==========================================
             */

            if (needsSearch) {
              console.log(
                "Quantum: searching Tavily..."
              );

              const search =
                await tvly.search(
                  message,
                  {
                    searchDepth:
                      "basic",
                    maxResults: 5,
                  }
                );

              searchResults =
                search.results || [];

              /*
               * Send actual search results
               * to the browser BEFORE Groq.
               */

              sendEvent(
                controller,
                {
                  type: "research",
                  results:
                    searchResults.map(
                      (result) => ({
                        title:
                          result.title,
                        url:
                          result.url,
                        content:
                          (
                            result.content ||
                            ""
                          ).slice(
                            0,
                            500
                          ),
                        score:
                          result.score,
                        publishedDate:
                          result.publishedDate,
                        favicon:
                          result.favicon,
                      })
                    ),
                }
              );

              sendEvent(
                controller,
                {
                  type: "status",
                  status: "analyzing",
                }
              );
            }

            /*
             * ==========================================
             * PREPARE RESEARCH FOR GROQ
             * ==========================================
             *
             * We intentionally truncate web content.
             * Smaller input = better responsiveness.
             */

            const researchContext =
              needsSearch
                ? compactResearch(
                    searchResults
                  )
                : "";

            /*
             * ==========================================
             * CONVERSATION CONTEXT
             * ==========================================
             */

            const previousMessages =
              history
                .slice(-8)
                .map(
                  (item) => ({
                    role: item.role,
                    content:
                      item.content.slice(
                        0,
                        4000
                      ),
                  })
                );

            /*
             * ==========================================
             * SYSTEM PROMPT
             * ==========================================
             */

            const systemPrompt = `
You are Quantum AI.

You are a fast, intelligent AI research assistant.

Rules:

- Answer directly.
- Be accurate.
- Do not invent sources.
- Maintain conversation context.
- If current web research is provided, use it.
- Do not claim you searched the web unless research was provided.
- Use Markdown.
- Use tables when useful.
- Format code using fenced Markdown.
- Do not unnecessarily repeat the research.
- Keep the final answer focused and useful.
- Be precise and professional.
- Read the internet. It is a must
`;

            let userPrompt =
              message;

            if (researchContext) {
              userPrompt = `
USER QUESTION:

${message}

LIVE WEB RESEARCH:

${researchContext}

Use the supplied research to answer the question.
Cite the relevant source numbers naturally when useful,
for example [1] or [2].
`;
            }

            const groqMessages = [
              {
                role: "system" as const,
                content:
                  systemPrompt,
              },

              ...previousMessages,

              {
                role: "user" as const,
                content:
                  userPrompt,
              },
            ];

            /*
             * ==========================================
             * GROQ STREAM
             * ==========================================
             */

            console.log(
              "Quantum: starting Groq..."
            );

            const groqStream =
              await groq.chat.completions.create(
                {
                  model:
                    "llama-3.1-8b-instant",

                  messages:
                    groqMessages,

                  stream: true,

                  temperature: 0.3,

                  max_tokens: 1800,
                }
              );

            for await (
              const chunk of groqStream
            ) {
              const text =
                chunk
                  .choices[0]
                  ?.delta
                  ?.content || "";

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
             * ==========================================
             * SAVE TO MONGODB
             * ==========================================
             */

            const client =
              await clientPromise;

            const db =
              client.db(
                process.env.MONGODB_DB ||
                  "quantum"
              );

            const sources =
              searchResults.map(
                (result) => ({
                  title:
                    result.title,
                  url:
                    result.url,
                  favicon:
                    result.favicon,
                })
              );

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
                createdAt:
                  new Date(),
              };

            let savedConversationId =
              conversationId;

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

              const result =
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
                      $push:
                        {
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
                result.matchedCount ===
                0
              ) {
                throw new Error(
                  "Conversation not found."
                );
              }
            } else {
              const title =
  await generateConversationTitle({
    userMessage: message,
    assistantAnswer: fullAnswer,
  });

              const result =
  await db
    .collection("conversations")
    .insertOne({
      userId,
      title,
      messages: [
        userMessage,
        assistantMessage,
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

              savedConversationId =
                result.insertedId.toString();
            }

            /*
             * ==========================================
             * FINISHED
             * ==========================================
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
                  error instanceof Error
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
          error instanceof Error
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