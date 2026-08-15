"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Check,
  ChevronDown,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";

import {
  DEFAULT_QUANTUM_SETTINGS,
  type QuantumSettings,
} from "@/lib/quantum-settings";

const sectionClass =
  "overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025] shadow-[0_20px_80px_rgba(0,0,0,0.12)]";

export default function SettingsClient() {
  const [settings, setSettings] =
    useState<QuantumSettings>(
      DEFAULT_QUANTUM_SETTINGS
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const saveTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  /* ========================================================
     LOAD
  ======================================================== */

  useEffect(() => {
    async function loadSettings() {
      try {
        const response =
          await fetch(
            "/api/settings",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to load settings."
          );
        }

        setSettings(
          data.settings ||
            DEFAULT_QUANTUM_SETTINGS
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load settings."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      if (saveTimer.current) {
        clearTimeout(
          saveTimer.current
        );
      }
    };
  }, []);

  /* ========================================================
     UPDATE
  ======================================================== */

  function updateSetting<
    K extends keyof QuantumSettings
  >(
    key: K,
    value: QuantumSettings[K]
  ) {
    setSettings(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );

    setSaved(false);
  }

  /* ========================================================
     SAVE
  ======================================================== */

  async function saveSettings(
    nextSettings = settings
  ) {
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const response =
        await fetch(
          "/api/settings",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              nextSettings
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to save settings."
        );
      }

      if (data.settings) {
        setSettings(
          data.settings
        );
      }

      setSaved(true);

      if (saveTimer.current) {
        clearTimeout(
          saveTimer.current
        );
      }

      saveTimer.current =
        setTimeout(() => {
          setSaved(false);
        }, 2500);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ========================================================
     AUTO SAVE INDIVIDUAL SWITCHES
  ======================================================== */

  function updateAndAutoSave<
    K extends keyof QuantumSettings
  >(
    key: K,
    value: QuantumSettings[K]
  ) {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(nextSettings);

    void saveSettings(
      nextSettings
    );
  }

  /* ========================================================
     RESET
  ======================================================== */

  async function resetSettings() {
    setSettings(
      DEFAULT_QUANTUM_SETTINGS
    );

    await saveSettings(
      DEFAULT_QUANTUM_SETTINGS
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          Loading Quantum settings...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.04] px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ====================================================
          AI BEHAVIOR
      ==================================================== */}

      <section
        className={
          sectionClass
        }
      >
        <SectionHeader
          icon={
            <Sparkles className="h-4 w-4 text-cyan-300" />
          }
          title="AI behavior"
          description="Choose how Quantum normally thinks and communicates."
        />

        <div className="divide-y divide-white/[0.05]">
          <SelectRow
            title="Response style"
            description="Controls the tone and depth of explanations."
            value={
              settings.responseStyle
            }
            options={[
              {
                value:
                  "balanced",
                label:
                  "Balanced",
                description:
                  "Natural, useful, professional",
              },
              {
                value:
                  "concise",
                label:
                  "Concise",
                description:
                  "Direct and to the point",
              },
              {
                value:
                  "detailed",
                label:
                  "Detailed",
                description:
                  "Thorough with more context",
              },
              {
                value:
                  "academic",
                label:
                  "Academic",
                description:
                  "Structured and analytical",
              },
            ]}
            onChange={(value) =>
              updateAndAutoSave(
                "responseStyle",
                value as QuantumSettings["responseStyle"]
              )
            }
          />

          <SelectRow
            title="Response length"
            description="How much detail Quantum should normally provide."
            value={
              settings.responseLength
            }
            options={[
              {
                value:
                  "short",
                label:
                  "Short",
                description:
                  "Compact answers",
              },
              {
                value:
                  "medium",
                label:
                  "Medium",
                description:
                  "Balanced detail",
              },
              {
                value:
                  "long",
                label:
                  "Long",
                description:
                  "Detailed answers",
              },
            ]}
            onChange={(value) =>
              updateAndAutoSave(
                "responseLength",
                value as QuantumSettings["responseLength"]
              )
            }
          />

          <SelectRow
            title="Web search"
            description="Controls when Quantum uses Tavily live research."
            value={
              settings.searchMode
            }
            options={[
              {
                value:
                  "auto",
                label:
                  "Automatic",
                description:
                  "Quantum decides when research helps",
              },
              {
                value:
                  "always",
                label:
                  "Always search",
                description:
                  "Search for substantive requests",
              },
              {
                value:
                  "never",
                label:
                  "Never search",
                description:
                  "Use the AI without Tavily research",
              },
            ]}
            onChange={(value) =>
              updateAndAutoSave(
                "searchMode",
                value as QuantumSettings["searchMode"]
              )
            }
          />
        </div>
      </section>

      {/* ====================================================
          PRESENTATION
      ==================================================== */}

      <section
        className={
          sectionClass
        }
      >
        <SectionHeader
          icon={
            <Sparkles className="h-4 w-4 text-violet-300" />
          }
          title="Answer presentation"
          description="Choose what appears around Quantum's response."
        />

        <div className="divide-y divide-white/[0.05]">
          <ToggleRow
            title="Markdown formatting"
            description="Use headings, emphasis, lists and structured formatting."
            checked={
              settings.useMarkdown
            }
            onChange={(value) =>
              updateAndAutoSave(
                "useMarkdown",
                value
              )
            }
          />

          <ToggleRow
            title="Comparison tables"
            description="Use tables when comparing options or data."
            checked={
              settings.preferTables
            }
            onChange={(value) =>
              updateAndAutoSave(
                "preferTables",
                value
              )
            }
          />

          <ToggleRow
            title="Code examples"
            description="Prefer useful examples when explaining programming topics."
            checked={
              settings.preferCodeExamples
            }
            onChange={(value) =>
              updateAndAutoSave(
                "preferCodeExamples",
                value
              )
            }
          />

          <ToggleRow
            title="Research cards"
            description="Show the web pages Quantum found before the answer."
            checked={
              settings.showResearch
            }
            onChange={(value) =>
              updateAndAutoSave(
                "showResearch",
                value
              )
            }
          />

          <ToggleRow
            title="Sources"
            description="Show links to the sources used in the final answer."
            checked={
              settings.showSources
            }
            onChange={(value) =>
              updateAndAutoSave(
                "showSources",
                value
              )
            }
          />
        </div>
      </section>

      {/* ====================================================
          CUSTOM INSTRUCTIONS
      ==================================================== */}

      <section
        className={
          sectionClass
        }
      >
        <SectionHeader
          icon={
            <span className="text-sm font-bold text-cyan-300">
              ✦
            </span>
          }
          title="Custom instructions"
          description="Tell Quantum how you personally prefer to receive answers."
        />

        <div className="p-5">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 transition focus-within:border-cyan-300/20">
            <textarea
              value={
                settings.customInstructions
              }
              maxLength={2000}
              rows={9}
              onChange={(
                event
              ) =>
                updateSetting(
                  "customInstructions",
                  event.target
                    .value
                )
              }
              placeholder={`Examples:

Explain difficult technical concepts step by step.

Use practical examples.

Prefer TypeScript for programming examples.

Keep the introduction short.

Assume I am learning, not an expert.`}
              className="w-full resize-y bg-transparent px-5 py-4 text-sm leading-7 text-slate-300 outline-none placeholder:text-slate-700"
            />

            <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5">
              <span className="text-[10px] text-slate-700">
                Your preferences are combined with Quantum's
                core instructions.
              </span>

              <span className="text-[10px] text-slate-600">
                {
                  settings
                    .customInstructions
                    .length
                }{" "}
                / 2000
              </span>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-700">
            Custom instructions cannot replace
            Quantum's core accuracy, security, and
            research rules.
          </p>
        </div>
      </section>

      {/* ====================================================
          SAVE BAR
      ==================================================== */}

      <div className="sticky bottom-4 z-20 rounded-2xl border border-white/[0.08] bg-[#070c18]/90 p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="px-2">
            {saved ? (
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                Settings saved
              </div>
            ) : (
              <div className="text-xs text-slate-600">
                Quantum will use these preferences on your
                next request.
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                void resetSettings()
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            <button
              type="button"
              disabled={
                saving
              }
              onClick={() =>
                void saveSettings()
              }
              className="flex min-w-[130px] items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}

              {saving
                ? "Saving..."
                : saved
                ? "Saved"
                : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION HEADER
========================================================= */

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.06] p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
        {icon}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   SELECT ROW
========================================================= */

function SelectRow({
  title,
  description,
  value,
  options,
  onChange,
}: {
  title: string;
  description: string;
  value: string;
  options: {
    value: string;
    label: string;
    description: string;
  }[];
  onChange: (
    value: string
  ) => void;
}) {
  const selected =
    options.find(
      (option) =>
        option.value === value
    );

  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-medium text-slate-300">
          {title}
        </h3>

        <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">
          {description}
        </p>
      </div>

      <div className="relative w-full sm:w-[230px]">
        <select
          value={value}
          onChange={(event) =>
            onChange(
              event.target
                .value
            )
          }
          className="w-full appearance-none rounded-xl border border-white/[0.08] bg-[#050a16] px-3 py-3 pr-10 text-sm text-slate-300 outline-none transition hover:border-white/[0.12] focus:border-cyan-300/20"
        >
          {options.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {option.label}
              </option>
            )
          )}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

        {selected && (
          <p className="mt-1.5 px-1 text-[10px] text-slate-700">
            {
              selected.description
            }
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   TOGGLE
========================================================= */

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 p-5">
      <div>
        <h3 className="text-sm font-medium text-slate-300">
          {title}
        </h3>

        <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">
          {description}
        </p>
      </div>

      <button
        type="button"
        aria-pressed={
          checked
        }
        onClick={() =>
          onChange(!checked)
        }
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked
            ? "bg-cyan-300"
            : "bg-white/[0.10]"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
            checked
              ? "left-6"
              : "left-1"
          }`}
        />
      </button>
    </div>
  );
}