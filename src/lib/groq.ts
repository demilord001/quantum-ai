import Groq from "groq-sdk";

/*
 * Main Quantum model.
 *
 * Groq currently lists:
 * - 131,072 context tokens
 * - 65,536 maximum completion tokens
 *
 * This is a better fit for long research, poems,
 * articles, and multi-turn conversations.
 */

export const QUANTUM_MODEL =
  "openai/gpt-oss-120b";

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    "GROQ_API_KEY is missing from .env.local"
  );
}

export const groq = new Groq({
  apiKey:
    process.env.GROQ_API_KEY,
});