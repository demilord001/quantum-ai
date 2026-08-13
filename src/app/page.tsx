import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import {
  ArrowRight,
  BrainCircuit,
  Globe2,
  Sparkles,
  Zap,
} from "lucide-react";

export default async function HomePage() {
  /*
   * ==================================================
   * SIGNED-IN USERS GO DIRECTLY TO CHAT
   * ==================================================
   */

  const { isAuthenticated } = await auth();

  if (isAuthenticated) {
    redirect("/chat");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* ==================================================
          BACKGROUND
      ================================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Cyan glow */}
        <div className="absolute left-[-180px] top-[-100px] h-[520px] w-[520px] rounded-full bg-cyan-500/[0.10] blur-[140px]" />

        {/* Violet glow */}
        <div className="absolute right-[-180px] top-[20%] h-[550px] w-[550px] rounded-full bg-violet-600/[0.10] blur-[150px]" />

        {/* Bottom blue glow */}
        <div className="absolute bottom-[-250px] left-[35%] h-[500px] w-[500px] rounded-full bg-sky-500/[0.06] blur-[150px]" />

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(255,255,255,0.025) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,0.025) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "44px 44px",
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(2,6,23,0.55)_100%)]" />
      </div>

      {/* ==================================================
          NAVBAR
      ================================================== */}

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        {/* Logo */}

        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] shadow-[0_0_30px_rgba(34,211,238,0.12)]">
            <Sparkles className="h-5 w-5 text-cyan-300" />

            <div className="absolute inset-0 rounded-xl border border-cyan-300/10 animate-pulse" />
          </div>

          <div>
            <div className="text-lg font-semibold tracking-[0.12em]">
              QUANTUM
            </div>

            <div className="text-[9px] tracking-[0.38em] text-slate-600">
              INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Authentication */}

        <div className="flex items-center gap-3">
          <SignInButton forceRedirectUrl="/chat">
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
            >
              Sign In
            </button>
          </SignInButton>

          <SignUpButton forceRedirectUrl="/chat">
            <button
              type="button"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black shadow-[0_0_30px_rgba(255,255,255,0.08)] transition hover:scale-105 hover:bg-slate-100"
            >
              Get Started
            </button>
          </SignUpButton>
        </div>
      </header>

      {/* ==================================================
          HERO
      ================================================== */}

      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-20 text-center lg:pt-28">
        {/* Status pill */}

        <div className="mb-8 flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-2 backdrop-blur-xl">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />

          <span className="text-xs font-medium tracking-[0.08em] text-cyan-300">
            REAL-TIME AI RESEARCH
          </span>
        </div>

        {/* Heading */}

        <h1 className="max-w-5xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-8xl">
          Search less.
          <br />
          <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">
            Understand more.
          </span>
        </h1>

        {/* Description */}

        <p className="mt-8 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
          Quantum combines intelligent reasoning with live web
          research so you can explore complex questions without
          opening dozens of tabs.
        </p>

        {/* Buttons */}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <SignUpButton forceRedirectUrl="/chat">
            <button
              type="button"
              className="group flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 font-medium text-black transition hover:scale-105 hover:bg-slate-100"
            >
              Start using Quantum

              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
          </SignUpButton>

          <SignInButton forceRedirectUrl="/chat">
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-white/[0.035] px-7 py-4 text-slate-200 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              I already have an account
            </button>
          </SignInButton>
        </div>

        {/* ==================================================
            QUANTUM CORE
        ================================================== */}

        <div className="relative mt-28 flex h-[300px] w-[300px] items-center justify-center">
          {/* Glow */}

          <div className="absolute h-44 w-44 rounded-full bg-cyan-300/10 blur-[70px]" />

          <div className="absolute h-40 w-40 rounded-full bg-violet-400/[0.06] blur-[50px]" />

          {/* Orbital rings */}

          <div className="absolute h-52 w-52 rounded-full border border-cyan-300/[0.12] animate-[spin_18s_linear_infinite]" />

          <div className="absolute h-64 w-64 rounded-full border border-violet-400/[0.10] animate-[spin_25s_linear_infinite_reverse]" />

          <div className="absolute h-72 w-72 rounded-full border border-white/[0.035]" />

          {/* Core */}

          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.16] to-violet-500/[0.16] shadow-[0_0_80px_rgba(34,211,238,0.16)] backdrop-blur-xl">
            <Sparkles className="h-10 w-10 text-cyan-200" />

            <div className="absolute inset-0 rounded-full border border-cyan-300/[0.08] animate-pulse" />
          </div>
        </div>
      </section>

      {/* ==================================================
          FEATURES
      ================================================== */}

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-6 pb-28 md:grid-cols-3">
        <FeatureCard
          icon={<Globe2 className="h-5 w-5" />}
          title="Live Web Research"
          description="Search current information instead of depending only on old model knowledge."
        />

        <FeatureCard
          icon={<BrainCircuit className="h-5 w-5" />}
          title="Deep Context"
          description="Continue a conversation naturally without repeatedly explaining what you mean."
        />

        <FeatureCard
          icon={<Zap className="h-5 w-5" />}
          title="Fast Intelligence"
          description="Get synthesized answers and sources instead of jumping between countless tabs."
        />
      </section>

      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer className="relative z-10 border-t border-white/[0.05] py-8 text-center text-xs tracking-wide text-slate-700">
        QUANTUM INTELLIGENCE
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/15 hover:bg-white/[0.045]">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-300">
        {icon}
      </div>

      <h2 className="font-medium text-slate-200">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}