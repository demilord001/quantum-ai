import {
  extractUrl,
  isYouTubeUrl,
} from "@/lib/search-decision";

import { tvly } from "@/lib/tavily";

/* =========================================================
   TYPES
========================================================= */

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

/* =========================================================
   LIMITS
========================================================= */

const MAX_RESULTS = 5;

const MAX_RESULT_CONTENT = 800;

const MAX_PAGE_CONTENT = 5000;

/* =========================================================
   CLEAN TEXT
========================================================= */

function cleanText(
  text: string
) {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   TOPIC DETECTION
========================================================= */

function detectTopic(
  query: string
) {
  const text =
    query.toLowerCase();

  const financeTerms = [
    "stock",
    "stocks",
    "shares",
    "share price",
    "market",
    "market cap",
    "forex",
    "crypto",
    "bitcoin",
    "ethereum",
    "earnings",
    "revenue",
    "finance",
    "financial",
  ];

  const newsTerms = [
    "news",
    "headlines",
    "breaking",
    "what happened",
    "today",
    "yesterday",
    "this week",
    "this month",
    "current events",
  ];

  if (
    financeTerms.some(
      (term) =>
        text.includes(term)
    )
  ) {
    return "finance" as const;
  }

  if (
    newsTerms.some(
      (term) =>
        text.includes(term)
    )
  ) {
    return "news" as const;
  }

  return "general" as const;
}

/* =========================================================
   TIME RANGE
========================================================= */

function detectTimeRange(
  query: string
) {
  const text =
    query.toLowerCase();

  if (
    text.includes("today") ||
    text.includes("yesterday") ||
    text.includes("this morning") ||
    text.includes("tonight")
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

/* =========================================================
   DIRECT PAGE EXTRACTION
========================================================= */

async function extractPage(
  url: string,
  userQuestion: string
): Promise<WebResearchResult> {
  const youtube =
    isYouTubeUrl(url);

  try {
    /*
     * IMPORTANT:
     *
     * Your installed @tavily/core version expects
     * the URL array as the first argument.
     *
     * Correct:
     *
     * tvly.extract([url], options)
     */

    const extraction =
      await tvly.extract(
        [url],
        {
          extractDepth:
            youtube
              ? "advanced"
              : "basic",

          format: "markdown",

          query:
            userQuestion ||
            url,

          chunksPerSource: 4,

          includeFavicon: true,
        }
      );

    const page =
      extraction.results?.[0];

    /*
     * Successful extraction
     */

    if (
      page?.rawContent
    ) {
      const rawContent =
        page.rawContent;

      return {
        query:
          userQuestion ||
          url,

        searched: true,

        type: "page",

        pageUrl: url,

        isYouTube:
          youtube,

        extractedContent:
          rawContent.slice(
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
                rawContent
              ).slice(
                0,
                MAX_RESULT_CONTENT
              ),

            favicon:
              page.favicon,

            sourceType:
              youtube
                ? "youtube"
                : "page",
          },
        ],
      };
    }
  } catch (error) {
    console.error(
      "TAVILY EXTRACT ERROR:",
      error
    );
  }

  /*
   * If extraction fails or produces no
   * usable content, fall back to search.
   */

  try {
    const fallback =
      await tvly.search(
        userQuestion ||
          url,
        {
          searchDepth:
            "basic",

          maxResults:
            MAX_RESULTS,

          includeFavicon:
            true,
        }
      );

    return {
      query:
        userQuestion ||
        url,

      searched: true,

      type: "search",

      isYouTube:
        youtube,

      results:
        fallback.results?.map(
          (result) => ({
            title:
              result.title,

            url:
              result.url,

            content:
              cleanText(
                result.content ||
                  ""
              ).slice(
                0,
                MAX_RESULT_CONTENT
              ),

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
  } catch (error) {
    console.error(
      "TAVILY FALLBACK SEARCH ERROR:",
      error
    );

    /*
     * Return an empty research result rather
     * than crashing the entire Quantum request.
     */

    return {
      query:
        userQuestion ||
        url,

      searched: true,

      type: "search",

      isYouTube:
        youtube,

      results: [],
    };
  }
}

/* =========================================================
   NORMAL WEB SEARCH
========================================================= */

async function searchWeb(
  query: string
): Promise<WebResearchResult> {
  const topic =
    detectTopic(query);

  const timeRange =
    detectTimeRange(query);

  try {
    const result =
      await tvly.search(
        query,
        {
          /*
           * Basic is cheaper/faster and is
           * sufficient for the normal search path.
           */
          searchDepth:
            "basic",

          maxResults:
            MAX_RESULTS,

          topic,

          ...(timeRange
            ? {
                timeRange,
              }
            : {}),

          chunksPerSource: 2,

          includeFavicon:
            true,

          /*
           * Don't request huge raw pages
           * during normal search.
           */
          includeRawContent:
            false,
        }
      );

    return {
      query,

      searched: true,

      type: "search",

      results:
        result.results?.map(
          (item) => ({
            title:
              item.title,

            url:
              item.url,

            content:
              cleanText(
                item.content ||
                  ""
              ).slice(
                0,
                MAX_RESULT_CONTENT
              ),

            score:
              item.score,

            publishedDate:
              item.publishedDate,

            favicon:
              item.favicon,

            sourceType:
              "web",
          })
        ) || [],
    };
  } catch (error) {
    console.error(
      "TAVILY SEARCH ERROR:",
      error
    );

    return {
      query,

      searched: true,

      type: "search",

      results: [],
    };
  }
}

/* =========================================================
   MAIN RESEARCH FUNCTION
========================================================= */

export async function researchWeb(
  query: string
): Promise<WebResearchResult> {
  const cleanQuery =
    query.trim();

  /*
   * Direct URL detection
   */

  const directUrl =
    extractUrl(
      cleanQuery
    );

  if (directUrl) {
    /*
     * Remove the URL from the question so
     * Tavily can focus on the user's actual
     * request about that page.
     */

    const pageQuestion =
      cleanQuery
        .replace(
          directUrl,
          ""
        )
        .trim();

    return extractPage(
      directUrl,
      pageQuestion
    );
  }

  /*
   * Normal search
   */

  return searchWeb(
    cleanQuery
  );
}