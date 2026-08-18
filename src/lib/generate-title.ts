import {
  groq,
  QUANTUM_MODEL,
} from "@/lib/groq";

function cleanTitle(
  value: string
) {
  return value
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

export async function generateConversationTitle({
  userMessage,
  assistantAnswer,
}: {
  userMessage: string;
  assistantAnswer: string;
}) {
  try {
    const response =
      await groq.chat.completions.create({
        model:
          QUANTUM_MODEL,

        messages: [
          {
            role: "system",

            content: `
Generate a short, natural title for an AI conversation.

Rules:
- The title must describe the SUBJECT of the conversation.
- Do not simply copy the user's question.
- Do not use "New Conversation".
- Do not use "Chat".
- Do not use "Conversation".
- Do not include quotation marks.
- Do not write a sentence.
- Use 2 to 6 words.
- Use Title Case.
- Return ONLY the title.

Examples:

User:
How do I fix authentication in Next.js?

Good:
Next.js Authentication

User:
Compare the latest iPhone and Samsung phones.

Good:
iPhone vs Samsung Comparison

User:
Explain why Hamlet delays revenge.

Good:
Hamlet's Delayed Revenge

User:
What are the causes of inflation?

Good:
Causes of Inflation
`,
          },

          {
            role: "user",

            content: `
USER MESSAGE:
${userMessage.slice(
  0,
  1600
)}

ASSISTANT ANSWER:
${assistantAnswer.slice(
  0,
  2200
)}
`,
          },
        ],

        temperature: 0.1,

        max_completion_tokens: 20,
      });

    const raw =
      response.choices[0]
        ?.message
        ?.content
        ?.trim() || "";

    const title =
      cleanTitle(raw);

    if (
      !title ||
      title.toLowerCase() ===
        "new conversation"
    ) {
      throw new Error(
        "Invalid generated title."
      );
    }

    return title;
  } catch (error) {
    console.error(
      "TITLE GENERATION ERROR:",
      error
    );

    /*
     * Reliable fallback:
     * create a topic-based title locally
     * instead of displaying "New Conversation".
     */

    return createFallbackTitle(
      userMessage
    );
  }
}

/* =========================================================
   LOCAL FALLBACK
========================================================= */

function createFallbackTitle(
  message: string
) {
  const text =
    message
      .replace(
        /https?:\/\/\S+/gi,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!text) {
    return "New Chat";
  }

  /*
   * Remove conversational prefixes so the title
   * isn't simply the first sentence.
   */

  const cleaned =
    text
      .replace(
        /^(please|can you|could you|tell me|explain|help me|what is|what are|how do i|how can i)\s+/i,
        ""
      )
      .trim();

  const words =
    cleaned
      .split(/\s+/)
      .slice(0, 5);

  let title =
    words.join(" ");

  title =
    title
      .replace(
        /[?!.:,;]+$/,
        ""
      )
      .trim();

  if (!title) {
    return "New Chat";
  }

  return title
    .split(" ")
    .map(
      (word) =>
        word.length > 1
          ? word.charAt(0).toUpperCase() +
            word.slice(1)
          : word
    )
    .join(" ")
    .slice(0, 60);
}