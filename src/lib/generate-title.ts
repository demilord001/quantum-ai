import {
  groq,
  QUANTUM_MODEL,
} from "@/lib/groq";

export async function generateConversationTitle({
  userMessage,
  assistantAnswer,
}: {
  userMessage: string;
  assistantAnswer: string;
}) {
  try {
    const response =
      await groq.chat.completions.create(
        {
          model:
            QUANTUM_MODEL,

          messages: [
            {
              role: "system",

              content: `
Create a short title describing the main subject of a conversation.

Rules:
- 2 to 6 words.
- Do not copy the user's sentence.
- Do not make it a question.
- Do not say "Chat about".
- Do not use quotation marks.
- Use Title Case.
- Return only the title.
`,
            },

            {
              role: "user",

              content: `
User:
${userMessage.slice(
  0,
  1400
)}

Answer:
${assistantAnswer.slice(
  0,
  1600
)}
`,
            },
          ],

          temperature: 0.1,

          max_completion_tokens: 20,
        }
      );

    const title =
      response.choices[0]
        ?.message
        ?.content
        ?.trim();

    return (
      title
        ?.replace(
          /^["']|["']$/g,
          ""
        )
        .replace(/\.$/, "")
        .slice(0, 80) ||
      "New Conversation"
    );
  } catch (error) {
    console.error(
      "TITLE GENERATION ERROR:",
      error
    );

    return "New Conversation";
  }
}