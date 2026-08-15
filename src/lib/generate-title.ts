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
Generate a short title for this conversation.

Rules:
- Describe the subject.
- Do not copy the first sentence.
- Do not make it a question.
- Do not say "Chat about".
- 2 to 6 words.
- Clear and natural.
- Title Case.
- Return ONLY the title.
`,
            },

            {
              role: "user",

              content: `
USER:
${userMessage.slice(
  0,
  2500
)}

ASSISTANT:
${assistantAnswer.slice(
  0,
  3000
)}
`,
            },
          ],

          temperature: 0.15,

          max_completion_tokens: 20,
        }
      );

    const title =
      response.choices[0]
        ?.message
        ?.content
        ?.trim();

    if (!title) {
      return "New Chat";
    }

    return title
      .replace(
        /^["']|["']$/g,
        ""
      )
      .replace(/\.$/, "")
      .slice(0, 80);
  } catch (error) {
    console.error(
      "TITLE GENERATION ERROR:",
      error
    );

    return "New conversation";
  }
}