import { groq } from "@/lib/groq";

export async function generateConversationTitle({
  userMessage,
  assistantAnswer,
}: {
  userMessage: string;
  assistantAnswer: string;
}) {
  const response =
    await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",

      messages: [
        {
          role: "system",
          content: `
You generate short conversation titles for an AI assistant.

Rules:
- Create a title that describes the overall topic.
- Do NOT simply copy the user's first sentence.
- Do NOT write a question.
- Do NOT use quotation marks.
- Do NOT say "Chat about".
- Keep it between 2 and 6 words.
- Make it specific and useful.
- Use title case.
- Return ONLY the title.
          `,
        },

        {
          role: "user",
          content: `
User message:

${userMessage}

Assistant response:

${assistantAnswer.slice(0, 3000)}
          `,
        },
      ],

      temperature: 0.2,

      max_tokens: 20,
    });

  const title =
    response.choices[0]?.message
      ?.content?.trim();

  if (!title) {
    return "New conversation";
  }

  return title
    .replace(/^["']|["']$/g, "")
    .replace(/\.$/, "")
    .slice(0, 80);
}