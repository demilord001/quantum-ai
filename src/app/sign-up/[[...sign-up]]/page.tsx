import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[130px]" />

      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[130px]" />

      <div className="relative z-10">
        <SignUp
          fallbackRedirectUrl="/chat"
          forceRedirectUrl="/chat"
        />
      </div>
    </main>
  );
}