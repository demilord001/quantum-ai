import { groq } from "@/lib/groq";

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
            "llama-3.1-8b-instant",

          messages: [
            {
              role: "system",

              content: `
Generate a concise title for an AI conversation.

Rules:
- Describe the overall subject, not the literal first sentence.
- Do not copy the user's wording verbatim.
- Do not ask a question.
- Do not say "Chat about".
- Do not use quotation marks.
- 2 to 6 words.
- Specific and natural.
- Title Case.
- Return ONLY the title.
`,
            },

            {
              role: "user",

              content: `
USER:
${userMessage}

ASSISTANT:
${assistantAnswer.slice(
  0,
  2500
)}
`,
            },
          ],

          temperature: 0.15,

          max_tokens: 20,
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
        .slice(0, 70) ||
      "New conversation"
    );
  } catch {
    return "New conversation";
  }
}