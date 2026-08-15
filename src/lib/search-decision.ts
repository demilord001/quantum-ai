const GREETING_PATTERNS = [
  /^hi[!. ]*$/i,
  /^hey[!. ]*$/i,
  /^hello[!. ]*$/i,
  /^hi there[!. ]*$/i,
  /^hey there[!. ]*$/i,
  /^good morning[!. ]*$/i,
  /^good afternoon[!. ]*$/i,
  /^good evening[!. ]*$/i,
  /^how are you[?.! ]*$/i,
  /^how's it going[?.! ]*$/i,
  /^what's up[?.! ]*$/i,
  /^thanks[!. ]*$/i,
  /^thank you[!. ]*$/i,
  /^ok[!. ]*$/i,
  /^okay[!. ]*$/i,
  /^cool[!. ]*$/i,
  /^nice[!. ]*$/i,
  /^great[!. ]*$/i,
];

const SIMPLE_NO_SEARCH_PATTERNS = [
  /^what is \d+\s*[+\-*/]\s*\d+\??$/i,
  /^\d+\s*[+\-*/]\s*\d+$/,
];

export function isCasualMessage(
  input: string
) {
  const text = input.trim();

  if (!text) {
    return true;
  }

  if (
    GREETING_PATTERNS.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  if (
    SIMPLE_NO_SEARCH_PATTERNS.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  return false;
}

export function shouldSearch(
  input: string
) {
  /*
   * Search almost everything.
   *
   * We only skip:
   * - greetings
   * - acknowledgements
   * - obvious local arithmetic
   *
   * This is intentionally NOT based on words
   * like "latest", "today", "news", etc.
   */

  return !isCasualMessage(input);
}

export function isUrl(
  input: string
) {
  try {
    const url =
      new URL(input.trim());

    return (
      url.protocol ===
        "http:" ||
      url.protocol ===
        "https:"
    );
  } catch {
    return false;
  }
}

export function extractUrl(
  input: string
) {
  const match =
    input.match(
      /https?:\/\/[^\s]+/i
    );

  if (!match) {
    return null;
  }

  return match[0].replace(
    /[),.!?]+$/,
    ""
  );
}

export function isYouTubeUrl(
  url: string
) {
  try {
    const hostname =
      new URL(url)
        .hostname
        .toLowerCase()
        .replace(/^www\./, "");

    return (
      hostname === "youtube.com" ||
      hostname ===
        "m.youtube.com" ||
      hostname ===
        "youtu.be"
    );
  } catch {
    return false;
  }
}