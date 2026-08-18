import {
  groq,
  QUANTUM_MODEL,
} from "@/lib/groq";

function normalize(
  text: string
) {
  return text
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(
  a: string,
  b: string
) {
  const wordsA =
    new Set(
      normalize(a)
        .split(" ")
        .filter(
          (word) =>
            word.length > 3
        )
    );

  const wordsB =
    new Set(
      normalize(b)
        .split(" ")
        .filter(
          (word) =>
            word.length > 3
        )
    );

  if (!wordsA.size || !wordsB.size) {
    return 0;
  }

  let matches = 0;

  for (const word of wordsA) {
    if (wordsB.has(word)) {
      matches++;
    }
  }

  return matches /
    Math.max(
      wordsA.size,
      wordsB.size
    );
}

function cleanTitle(
  title: string
) {
  return title
    .replace(
      /^["'`]+|["'`]+$/g,
      ""
    )
    .replace(
      /^title:\s*/i,
      ""
    )
    .replace(
      /^conversation title:\s*/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

function fallbackTitle(
  answer: string
) {
  const text =
    answer
      .replace(
        /^#+\s*/gm,
        ""
      )
      .replace(
        /[*_`]/g,
        ""
      )
      .replace(
        /\[[^\]]+\]\([^)]+\)/g,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

  if (!text) {
    return "New Chat";
  }

  /*
   * Take the beginning of the actual answer,
   * not the user's original question.
   */
  const words =
    text
      .split(" ")
      .filter(Boolean)
      .slice(0, 5);

  const title =
    words
      .join(" ")
      .replace(
        /[.,!?;:]+$/,
        ""
      );

  return title
    .split(" ")
    .map(
      (word) =>
        word.length > 1
          ? word
              .charAt(0)
              .toUpperCase() +
            word.slice(1)
          : word
    )
    .join(" ")
    .slice(0, 60);
}

export async function generateConversationTitle({
  userMessage,
  assistantAnswer,
}: {
  userMessage: string;
  assistantAnswer: string;
}) {
  try {
    /*
     * IMPORTANT:
     * The answer is the PRIMARY source for the title.
     * The user's prompt is only context.
     */

    const response =
      await groq.chat.completions.create({
        model:
          QUANTUM_MODEL,

        messages: [
          {
            role: "system",

            content: `
You generate short semantic titles for AI conversations.

Your job is NOT to rewrite the user's question.

Determine the MAIN TOPIC discussed in the conversation
by analyzing the assistant's answer.

RULES:

1. Focus primarily on the assistant's answer.
2. Use the user message only to resolve context.
3. Never copy the user's sentence.
4. Never make the title a question.
5. Never use the first prompt verbatim.
6. Never use:
   - New Conversation
   - New Chat
   - Chat
   - Conversation
7. Do not include quotation marks.
8. Use 2 to 5 words.
9. Use natural Title Case.
10. Describe the SUBJECT, not the request.

BAD:

User:
How do I fix Clerk authentication in Next.js?

Bad title:
How Do I Fix Clerk Authentication In Next.js?

GOOD:

Next.js Authentication

Another example:

User:
Compare two poems and explain their themes.

Good:
Poetry Theme Analysis

Another:

User:
How can I upload PDFs into my AI app?

Good:
AI Document Uploads

Return ONLY the title.
`,
          },

          {
            role: "user",

            content: `
ASSISTANT ANSWER — PRIMARY SOURCE:

${assistantAnswer.slice(
  0,
  5000
)}

USER MESSAGE — SECONDARY CONTEXT ONLY:

${userMessage.slice(
  0,
  600
)}

Generate the semantic topic title now.
`,
          },
        ],

        temperature: 0,

        max_completion_tokens: 20,
      });

    let title =
      cleanTitle(
        response
          .choices[0]
          ?.message
          ?.content || ""
      );

    if (!title) {
      return fallbackTitle(
        assistantAnswer
      );
    }

    /*
     * Reject a title that is too similar to the
     * user's original question.
     */

    const similarityScore =
      similarity(
        title,
        userMessage
      );

    if (
      similarityScore >
      0.55
    ) {
      /*
       * Second attempt using ONLY the answer.
       */

      const retry =
        await groq.chat.completions.create({
          model:
            QUANTUM_MODEL,

          messages: [
            {
              role: "system",

              content: `
Create a semantic conversation title.

Use ONLY the assistant's answer.

Do not copy any sentence from the answer.
Do not create a question.
Do not use "Chat", "Conversation",
"New Chat", or "New Conversation".

Use 2 to 5 words.

Return ONLY the title.
`,
            },

            {
              role: "user",

              content:
                assistantAnswer.slice(
                  0,
                  6000
                ),
            },
          ],

          temperature: 0,

          max_completion_tokens: 20,
        });

      title =
        cleanTitle(
          retry
            .choices[0]
            ?.message
            ?.content || ""
        );
    }

    if (
      !title ||
      title
        .toLowerCase()
        .includes(
          "new conversation"
        ) ||
      title
        .toLowerCase()
        .includes(
          "new chat"
        )
    ) {
      return fallbackTitle(
        assistantAnswer
      );
    }

    return title;
  } catch (error) {
    console.error(
      "TITLE GENERATION ERROR:",
      error
    );

    return fallbackTitle(
      assistantAnswer
    );
  }
}