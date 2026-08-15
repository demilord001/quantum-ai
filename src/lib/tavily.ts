import {
  tavily,
} from "@tavily/core";

if (!process.env.TAVILY_API_KEY) {
  throw new Error(
    "TAVILY_API_KEY is missing."
  );
}

export const tvly =
  tavily({
    apiKey:
      process.env.TAVILY_API_KEY,
  });