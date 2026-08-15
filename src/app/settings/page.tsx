import Link from "next/link";

import {
  ArrowLeft,
  Sparkles,
} from "lucide-react";

import { auth } from "@clerk/nextjs/server";

import SettingsClient from "@/components/settings-client";

export default async function SettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[20%] top-[-240px] h-[500px] w-[500px] rounded-full bg-cyan-400/[0.04] blur-[150px]" />

        <div className="absolute right-[-150px] top-[35%] h-[500px] w-[500px] rounded-full bg-violet-500/[0.035] blur-[150px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/chat"
            className="mb-6 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Quantum
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06]">
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Settings
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Customize how Quantum thinks, searches,
                and communicates.
              </p>
            </div>
          </div>
        </div>

        <SettingsClient />
      </div>
    </main>
  );
}