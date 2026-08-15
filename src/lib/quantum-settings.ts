export type ResponseStyle =
  | "balanced"
  | "concise"
  | "detailed"
  | "academic";

export type ResponseLength =
  | "short"
  | "medium"
  | "long";

export type SearchMode =
  | "auto"
  | "always"
  | "never";

export interface QuantumSettings {
  responseStyle: ResponseStyle;

  responseLength: ResponseLength;

  searchMode: SearchMode;

  showSources: boolean;

  showResearch: boolean;

  useMarkdown: boolean;

  preferTables: boolean;

  preferCodeExamples: boolean;

  customInstructions: string;
}

export const DEFAULT_QUANTUM_SETTINGS: QuantumSettings = {
  responseStyle: "balanced",

  responseLength: "medium",

  searchMode: "auto",

  showSources: true,

  showResearch: true,

  useMarkdown: true,

  preferTables: true,

  preferCodeExamples: true,

  customInstructions: "",
};

/* =========================================================
   SANITIZATION
========================================================= */

export function sanitizeQuantumSettings(
  input: Partial<QuantumSettings>
): QuantumSettings {
  const style =
    input.responseStyle;

  const length =
    input.responseLength;

  const search =
    input.searchMode;

  return {
    responseStyle:
      style === "balanced" ||
      style === "concise" ||
      style === "detailed" ||
      style === "academic"
        ? style
        : DEFAULT_QUANTUM_SETTINGS.responseStyle,

    responseLength:
      length === "short" ||
      length === "medium" ||
      length === "long"
        ? length
        : DEFAULT_QUANTUM_SETTINGS.responseLength,

    searchMode:
      search === "auto" ||
      search === "always" ||
      search === "never"
        ? search
        : DEFAULT_QUANTUM_SETTINGS.searchMode,

    showSources:
      typeof input.showSources ===
      "boolean"
        ? input.showSources
        : DEFAULT_QUANTUM_SETTINGS.showSources,

    showResearch:
      typeof input.showResearch ===
      "boolean"
        ? input.showResearch
        : DEFAULT_QUANTUM_SETTINGS.showResearch,

    useMarkdown:
      typeof input.useMarkdown ===
      "boolean"
        ? input.useMarkdown
        : DEFAULT_QUANTUM_SETTINGS.useMarkdown,

    preferTables:
      typeof input.preferTables ===
      "boolean"
        ? input.preferTables
        : DEFAULT_QUANTUM_SETTINGS.preferTables,

    preferCodeExamples:
      typeof input.preferCodeExamples ===
      "boolean"
        ? input.preferCodeExamples
        : DEFAULT_QUANTUM_SETTINGS.preferCodeExamples,

    customInstructions:
      typeof input.customInstructions ===
      "string"
        ? input.customInstructions
            .trim()
            .slice(0, 2000)
        : DEFAULT_QUANTUM_SETTINGS.customInstructions,
  };
}