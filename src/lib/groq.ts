import Groq from "groq-sdk";

export const QUANTUM_MODEL =
  "llama-3.3-70b-versatile";

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    "GROQ_API_KEY is missing."
  );
}

export const groq = new Groq({
  apiKey:
    process.env.GROQ_API_KEY,
});