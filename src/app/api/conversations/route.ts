import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    console.log(
      "========== QUANTUM CONVERSATIONS =========="
    );

    // -----------------------------------------
    // CLERK
    // -----------------------------------------

    const {
      isAuthenticated,
      userId,
    } = await auth();

    console.log("isAuthenticated:", isAuthenticated);
    console.log("userId:", userId);

    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Please sign in.",
        },
        {
          status: 401,
        }
      );
    }

    // -----------------------------------------
    // MONGODB ENVIRONMENT
    // -----------------------------------------

    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing from .env.local"
      );
    }

    const databaseName =
      process.env.MONGODB_DB || "quantum";

    console.log(
      "Database:",
      databaseName
    );

    // -----------------------------------------
    // CONNECT
    // -----------------------------------------

    const client =
      await clientPromise;

    console.log(
      "MongoDB connection successful."
    );

    const db =
      client.db(databaseName);

    // -----------------------------------------
    // FIND USER CONVERSATIONS
    // -----------------------------------------

    const conversations =
      await db
        .collection("conversations")
        .find({
          userId,
        })
        .sort({
          updatedAt: -1,
        })
        .toArray();

    console.log(
      "Conversation count:",
      conversations.length
    );

    // -----------------------------------------
    // RETURN JSON
    // -----------------------------------------

    return NextResponse.json(
      conversations.map(
        (conversation) => ({
          _id:
            conversation._id.toString(),

          title:
            conversation.title ||
            "New conversation",

          messages:
            conversation.messages ||
            [],

          createdAt:
            conversation.createdAt,

          updatedAt:
            conversation.updatedAt,
        })
      )
    );
  } catch (error) {
    console.error(
      "========== QUANTUM CONVERSATIONS ERROR =========="
    );

    console.error(error);

    console.error(
      "================================================="
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load conversations.",
      },
      {
        status: 500,
      }
    );
  }
}