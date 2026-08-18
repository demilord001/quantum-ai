import "pdf-parse/worker";

import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const MAX_FILE_SIZE =
  10 * 1024 * 1024;

export const MAX_FILES_PER_REQUEST =
  3;

export const MAX_TOTAL_FILE_TEXT =
  12000;

export const MAX_FILE_TEXT =
  7000;

export interface ExtractedFile {
  name: string;
  size: number;
  type: string;
  text: string;
  truncated: boolean;
}

const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".pdf",
  ".docx",
];

function extension(
  filename: string
) {
  const name =
    filename.toLowerCase();

  const position =
    name.lastIndexOf(".");

  return position === -1
    ? ""
    : name.slice(position);
}

export function isSupportedFile(
  file: File
) {
  return SUPPORTED_EXTENSIONS.includes(
    extension(file.name)
  );
}

function cleanText(
  value: string
) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function truncate(
  value: string,
  limit = MAX_FILE_TEXT
) {
  const cleaned =
    cleanText(value);

  return {
    text:
      cleaned.slice(
        0,
        limit
      ),

    truncated:
      cleaned.length > limit,
  };
}

async function readTextFile(
  file: File
): Promise<ExtractedFile> {
  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  const result =
    truncate(
      buffer.toString(
        "utf8"
      )
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

async function readPdf(
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

    const limited =
      truncate(
        result.text || ""
      );

    return {
      name: file.name,
      size: file.size,
      type:
        "application/pdf",
      text: limited.text,
      truncated:
        limited.truncated,
    };
  } finally {
    await parser.destroy();
  }
}

async function readDocx(
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

  const limited =
    truncate(
      result.value || ""
    );

  return {
    name: file.name,
    size: file.size,

    type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    text: limited.text,

    truncated:
      limited.truncated,
  };
}

export async function extractFile(
  file: File
): Promise<ExtractedFile> {
  if (
    !(file instanceof File)
  ) {
    throw new Error(
      "Invalid uploaded file."
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      `${file.name} is larger than 10 MB.`
    );
  }

  if (
    !isSupportedFile(file)
  ) {
    throw new Error(
      `Unsupported file type: ${file.name}`
    );
  }

  switch (
    extension(file.name)
  ) {
    case ".pdf":
      return readPdf(file);

    case ".docx":
      return readDocx(file);

    case ".txt":
    case ".md":
    case ".markdown":
    case ".csv":
    case ".json":
      return readTextFile(
        file
      );

    default:
      throw new Error(
        `Unsupported file type: ${file.name}`
      );
  }
}

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

    sections.push(`
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
    ? "This file was truncated to stay within Quantum's context budget."
    : ""
}
`);
  }

  return sections.join(
    "\n\n"
  );
}