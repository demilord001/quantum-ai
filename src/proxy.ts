import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Run Clerk on application routes
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",

    // IMPORTANT:
    // Always run Clerk on API routes.
    "/(api|trpc)(.*)",

    // Clerk's own frontend API
    "/__clerk/(.*)",
  ],
};