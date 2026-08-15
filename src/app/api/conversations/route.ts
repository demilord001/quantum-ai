import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const {
      isAuthenticated,
      userId,
    } = await auth();

    if (
      !isAuthenticated ||
      !userId
    ) {
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

    const client =
      await clientPromise;

    const db =
      client.db(
        process.env.MONGODB_DB ||
          "quantum"
      );

    const conversations =
      await db
        .collection(
          "conversations"
        )
        .find({
          userId,
        })
        .sort({
          updatedAt: -1,
        })
        .toArray();

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
      "GET CONVERSATIONS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
            Error
            ? error.message
            : "Failed to load conversations.",
      },
      {
        status: 500,
      }
    );
  }
}