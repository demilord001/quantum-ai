import {
  auth,
  currentUser,
} from "@clerk/nextjs/server";

import QuantumChat from "@/components/quantum-chat";

export default async function ChatPage() {
  // Ensure user is authenticated via middleware, but verify again here
  const authSession = await auth();
  
  if (!authSession.userId) {
    throw new Error("Unauthorized: User must be logged in");
  }

  // Get Clerk profile with error handling
  let user = null;
  try {
    user = await currentUser();
  } catch (error) {
    console.error("Error fetching current user:", error);
    // Fall back to using auth session data if currentUser fails
  }

  const firstName =
    user?.firstName ||
    user?.username ||
    user
      ?.emailAddresses?.[0]
      ?.emailAddress
      ?.split("@")[0] ||
    "there";

  return (
    <main className="h-screen overflow-hidden bg-[#020617] text-white">
      <QuantumChat
        firstName={firstName}
      />
    </main>
  );
}