const GREETINGS = [
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
];

const ACKNOWLEDGEMENTS = [
  /^thanks[!. ]*$/i,
  /^thank you[!. ]*$/i,
  /^okay[!. ]*$/i,
  /^ok[!. ]*$/i,
  /^cool[!. ]*$/i,
  /^nice[!. ]*$/i,
  /^great[!. ]*$/i,
];

const SIMPLE_MATH =
  /^[\d\s()+\-*/%.]+$/;

export function isCasualMessage(
  input: string
) {
  const text =
    input.trim();

  if (!text) {
    return true;
  }

  if (
    GREETINGS.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  if (
    ACKNOWLEDGEMENTS.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  /*
   * Only skip obvious arithmetic.
   */
  if (
    SIMPLE_MATH.test(text) &&
    /[\d]/.test(text) &&
    /[+\-*/%]/.test(text)
  ) {
    return true;
  }

  return false;
}

export function shouldSearch(
  input: string
) {
  return !isCasualMessage(input);
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

export function isUrl(
  input: string
) {
  try {
    const url =
      new URL(input.trim());

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
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
      hostname ===
        "youtube.com" ||
      hostname ===
        "m.youtube.com" ||
      hostname ===
        "youtu.be"
    );
  } catch {
    return false;
  }
}