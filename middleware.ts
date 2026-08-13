import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/api/chat(.*)",
  "/api/conversations(.*)",
  "/api/memory(.*)",
  "/api/search(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!.*\\.js$|_next/static|_next/image|favicon.ico|public).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
