import Groq from "groq-sdk";

export const QUANTUM_MODEL =
  "openai/gpt-oss-120b";

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    "GROQ_API_KEY is missing."
  );
}

export const groq = new Groq({
  apiKey:
    process.env.GROQ_API_KEY,
});