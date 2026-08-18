import {
  auth,
  currentUser,
} from "@clerk/nextjs/server";

import QuantumChat from "@/components/quantum-chat";
import {
  DEFAULT_QUANTUM_SETTINGS,
} from "@/lib/quantum-settings";

export default async function ChatPage() {
  await auth.protect();

  const user =
    await currentUser();

  const firstName =
    user?.firstName ||
    user?.username ||
    user
      ?.emailAddresses?.[0]
      ?.emailAddress
      ?.split("@")[0] ||
    "there";

  return (
    <main className="h-screen w-full overflow-hidden bg-[#020617] text-white">
      <QuantumChat
        firstName={firstName}
        initialSettings={DEFAULT_QUANTUM_SETTINGS}
      />
    </main>
  );
}