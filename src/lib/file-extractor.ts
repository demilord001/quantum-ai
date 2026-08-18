import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/* =========================================================
   LIMITS
========================================================= */

export const MAX_FILE_SIZE =
  10 * 1024 * 1024; // 10 MB

export const MAX_FILES_PER_REQUEST = 5;

/*
 * Total extracted file characters that will be sent
 * into the model context.
 */
export const MAX_TOTAL_FILE_TEXT =
  12_000;

/*
 * Maximum extracted characters retained from
 * an individual file.
 */
export const MAX_FILE_TEXT =
  7_000;

/* =========================================================
   TYPES
========================================================= */

export interface ExtractedFile {
  name: string;
  size: number;
  type: string;
  text: string;
  truncated: boolean;
}

/* =========================================================
   SUPPORTED EXTENSIONS
========================================================= */

export const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".pdf",
  ".docx",
] as const;

/* =========================================================
   HELPERS
========================================================= */

function getExtension(
  filename: string
) {
  const lower =
    filename.toLowerCase();

  const index =
    lower.lastIndexOf(".");

  if (index === -1) {
    return "";
  }

  return lower.slice(index);
}

export function isSupportedFile(
  file: File
) {
  return (
    SUPPORTED_EXTENSIONS as readonly string[]
  ).includes(
    getExtension(file.name)
  );
}

function normalizeText(
  text: string
) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function truncateText(
  text: string,
  limit = MAX_FILE_TEXT
) {
  const normalized =
    normalizeText(text);

  return {
    text:
      normalized.slice(
        0,
        limit
      ),

    truncated:
      normalized.length > limit,
  };
}

/* =========================================================
   TEXT FILES
========================================================= */

async function extractTextFile(
  file: File
): Promise<ExtractedFile> {
  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  const result =
    truncateText(
      buffer.toString("utf8")
    );

  return {
    name: file.name,

    size: file.size,

    type:
      file.type ||
      "text/plain",

    text: result.text,

    truncated:
      result.truncated,
  };
}

/* =========================================================
   PDF
========================================================= */

async function extractPdfFile(
  file: File
): Promise<ExtractedFile> {
  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  const parser =
    new PDFParse({
      data: buffer,
    });

  try {
    const result =
      await parser.getText();

    const extracted =
      truncateText(
        result.text || ""
      );

    return {
      name: file.name,

      size: file.size,

      type:
        "application/pdf",

      text: extracted.text,

      truncated:
        extracted.truncated,
    };
  } finally {
    await parser.destroy();
  }
}

/* =========================================================
   DOCX
========================================================= */

async function extractDocxFile(
  file: File
): Promise<ExtractedFile> {
  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  const result =
    await mammoth.extractRawText({
      buffer,
    });

  const extracted =
    truncateText(
      result.value || ""
    );

  return {
    name: file.name,

    size: file.size,

    type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    text: extracted.text,

    truncated:
      extracted.truncated,
  };
}

/* =========================================================
   MAIN EXTRACTOR
========================================================= */

export async function extractFile(
  file: File
): Promise<ExtractedFile> {
  if (!(file instanceof File)) {
    throw new Error(
      "Invalid uploaded file."
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `${file.name} is larger than 10 MB. Maximum size is 10 MB.`
    );
  }

  if (!isSupportedFile(file)) {
    throw new Error(
      `Unsupported file type: ${file.name}`
    );
  }

  const extension =
    getExtension(
      file.name
    );

  switch (extension) {
    case ".pdf":
      return extractPdfFile(
        file
      );

    case ".docx":
      return extractDocxFile(
        file
      );

    case ".txt":
    case ".md":
    case ".markdown":
    case ".csv":
    case ".json":
      return extractTextFile(
        file
      );

    default:
      throw new Error(
        `Unsupported file type: ${file.name}`
      );
  }
}

/* =========================================================
   BUILD MODEL CONTEXT
========================================================= */

export function buildFileContext(
  files: ExtractedFile[]
) {
  let remaining =
    MAX_TOTAL_FILE_TEXT;

  const sections: string[] = [];

  for (
    let index = 0;
    index < files.length;
    index++
  ) {
    if (remaining <= 0) {
      break;
    }

    const file =
      files[index];

    const text =
      file.text.slice(
        0,
        remaining
      );

    remaining -=
      text.length;

    sections.push(
      `
FILE ${index + 1}

NAME:
${file.name}

TYPE:
${file.type}

CONTENT:
${text}

${
  file.truncated ||
  text.length <
    file.text.length
    ? "NOTE: This file was truncated to stay within Quantum's context budget."
    : ""
}
`
    );
  }

  return sections.join(
    "\n"
  );
}