import {
  extractUrl,
  isYouTubeUrl,
} from "@/lib/search-decision";

import { tvly } from "@/lib/tavily";

export interface ResearchItem {
  title: string;
  url: string;
  content?: string;
  score?: number;
  publishedDate?: string;
  favicon?: string;
  sourceType?:
    | "web"
    | "page"
    | "youtube";
}

export interface WebResearchResult {
  query: string;

  searched: boolean;

  type:
    | "search"
    | "page"
    | "none";

  results: ResearchItem[];

  extractedContent?: string;

  pageUrl?: string;

  isYouTube?: boolean;
}

/*
 * Keep research small enough for fast model
 * processing.
 */

const MAX_RESULT_SNIPPET = 1200;
const MAX_PAGE_CONTENT = 12000;

function cleanText(
  value: string
) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function detectTopic(
  query: string
) {
  const text =
    query.toLowerCase();

  const financeSignals = [
    "stock",
    "stocks",
    "share price",
    "market cap",
    "forex",
    "crypto",
    "bitcoin",
    "ethereum",
    "earnings",
    "revenue",
    "financial",
    "finance",
  ];

  const newsSignals = [
    "news",
    "headline",
    "headlines",
    "what happened",
    "today",
    "yesterday",
    "this week",
    "this month",
    "breaking",
    "current events",
  ];

  if (
    financeSignals.some(
      (signal) =>
        text.includes(signal)
    )
  ) {
    return "finance" as const;
  }

  if (
    newsSignals.some(
      (signal) =>
        text.includes(signal)
    )
  ) {
    return "news" as const;
  }

  return "general" as const;
}

function detectTimeRange(
  query: string
) {
  const text =
    query.toLowerCase();

  if (
    text.includes("today") ||
    text.includes("this morning") ||
    text.includes("tonight") ||
    text.includes("yesterday")
  ) {
    return "day";
  }

  if (
    text.includes("this week") ||
    text.includes("last week") ||
    text.includes("past week")
  ) {
    return "week";
  }

  if (
    text.includes("this month") ||
    text.includes("last month") ||
    text.includes("past month")
  ) {
    return "month";
  }

  if (
    text.includes("this year") ||
    text.includes("last year") ||
    text.includes("past year")
  ) {
    return "year";
  }

  return undefined;
}

/*
 * ================================================
 * DIRECT PAGE / URL
 * ================================================
 */

async function extractPage(
  url: string,
  query: string
): Promise<WebResearchResult> {
  const youtube =
    isYouTubeUrl(url);

  const extraction =
    await tvly.extract(
      [url],
      {
        /*
         * Advanced extraction is useful for harder
         * pages, but it costs more and can be slower.
         */

        extractDepth:
          youtube
            ? "advanced"
            : "basic",

        format: "markdown",

        query:
          query || url,

        chunksPerSource: 5,

        includeFavicon: true,
      }
    );

  const result =
    extraction.results?.[0];

  if (
    result?.rawContent
  ) {
    return {
      query,

      searched: true,

      type: "page",

      pageUrl: url,

      isYouTube: youtube,

      extractedContent:
        result.rawContent.slice(
          0,
          MAX_PAGE_CONTENT
        ),

      results: [
        {
          title:
            youtube
              ? "YouTube page"
              : "Web page",

          url,

          content:
            cleanText(
              result.rawContent
            ).slice(
              0,
              MAX_RESULT_SNIPPET
            ),

          favicon:
            result.favicon,

          sourceType:
            youtube
              ? "youtube"
              : "page",
        },
      ],
    };
  }

  /*
   * If extraction didn't return useful content,
   * search the web as fallback.
   */

  const fallback =
    await tvly.search(
      query,
      {
        searchDepth: "basic",

        maxResults: 6,

        includeFavicon: true,
      }
    );

  return {
    query,

    searched: true,

    type: "search",

    isYouTube: youtube,

    results:
      fallback.results?.map(
        (result) => ({
          title:
            result.title,

          url:
            result.url,

          content:
            cleanText(
              result.content || ""
            ).slice(
              0,
              MAX_RESULT_SNIPPET
            ),

          score:
            result.score,

          publishedDate:
            result.publishedDate,

          favicon:
            result.favicon,

          sourceType:
            "youtube",
        })
      ) || [],
  };
}

/*
 * ================================================
 * WEB SEARCH
 * ================================================
 */

async function searchWeb(
  query: string
): Promise<WebResearchResult> {
  const topic =
    detectTopic(query);

  const timeRange =
    detectTimeRange(query);

  const search =
    await tvly.search(
      query,
      {
        searchDepth: "basic",

        maxResults: 6,

        topic,

        ...(timeRange
          ? {
              timeRange,
            }
          : {}),

        chunksPerSource: 3,

        includeFavicon: true,

        /*
         * Don't request huge raw documents
         * for a normal search.
         */

        includeRawContent: false,
      }
    );

  return {
    query,

    searched: true,

    type: "search",

    results:
      search.results?.map(
        (result) => ({
          title:
            result.title,

          url:
            result.url,

          content:
            cleanText(
              result.content || ""
            ).slice(
              0,
              MAX_RESULT_SNIPPET
            ),

          score:
            result.score,

          publishedDate:
            result.publishedDate,

          favicon:
            result.favicon,

          sourceType: "web",
        })
      ) || [],
  };
}

/*
 * ================================================
 * MAIN
 * ================================================
 */

export async function researchWeb(
  query: string
): Promise<WebResearchResult> {
  const cleanQuery =
    query.trim();

  const directUrl =
    extractUrl(cleanQuery);

  if (directUrl) {
    const textWithoutUrl =
      cleanQuery
        .replace(
          directUrl,
          ""
        )
        .trim();

    return extractPage(
      directUrl,
      textWithoutUrl ||
        cleanQuery
    );
  }

  return searchWeb(
    cleanQuery
  );
}