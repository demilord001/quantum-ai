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
    "this morning",
    "tonight",
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
    text.includes("past week") ||
    text.includes("last week")
  ) {
    return "week";
  }

  if (
    text.includes("this month") ||
    text.includes("past month") ||
    text.includes("last month")
  ) {
    return "month";
  }

  if (
    text.includes("this year") ||
    text.includes("past year") ||
    text.includes("last year")
  ) {
    return "year";
  }

  return undefined;
}

export async function researchWeb(
  query: string
): Promise<WebResearchResult> {
  const cleanQuery =
    query.trim();

  const directUrl =
    extractUrl(cleanQuery);

  /*
   * ==========================================
   * DIRECT URL
   * ==========================================
   */

  if (directUrl) {
    const youtube =
      isYouTubeUrl(directUrl);

    const pageQuestion =
      cleanQuery.replace(
        directUrl,
        ""
      ).trim();

    const extraction =
      await tvly.extract(
        [directUrl],
        {
          extractDepth:
            youtube
              ? "advanced"
              : "basic",

          format: "markdown",

          query:
            pageQuestion ||
            cleanQuery,

          chunksPerSource: 5,

          includeFavicon: true,
        }
      );

    const successful =
      extraction.results?.[0];

    if (
      successful?.rawContent
    ) {
      return {
        query: cleanQuery,
        searched: true,
        type: "page",
        pageUrl: directUrl,
        isYouTube: youtube,
        extractedContent:
          successful.rawContent,
        results: [
          {
            title: youtube
              ? "YouTube page"
              : "Web page",
            url: directUrl,
            content:
              successful.rawContent.slice(
                0,
                5000
              ),
            favicon:
              successful.favicon,
            sourceType:
              youtube
                ? "youtube"
                : "page",
          },
        ],
      };
    }

    /*
     * If extraction doesn't return useful
     * content, fall back to search.
     */

    const fallback =
      await tvly.search(
        cleanQuery,
        {
          searchDepth: "basic",
          maxResults: 6,
          includeFavicon: true,
        }
      );

    return {
      query: cleanQuery,
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
              result.content,
            score:
              result.score,
            publishedDate:
              result.publishedDate,
            favicon:
              result.favicon,
            sourceType:
              youtube
                ? "youtube"
                : "web",
          })
        ) || [],
    };
  }

  /*
   * ==========================================
   * NORMAL WEB SEARCH
   * ==========================================
   */

  const topic =
    detectTopic(
      cleanQuery
    );

  const timeRange =
    detectTimeRange(
      cleanQuery
    );

  const search =
    await tvly.search(
      cleanQuery,
      {
        searchDepth:
          "basic",

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
         * Keep raw content OFF in the normal
         * search path for speed.
         */
        includeRawContent: false,
      }
    );

  return {
    query: cleanQuery,
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
            result.content,

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