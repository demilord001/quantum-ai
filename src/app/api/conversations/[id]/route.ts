import {
  NextRequest,
  NextResponse,
} from "next/server";

import { ObjectId } from "mongodb";

import { auth } from "@clerk/nextjs/server";

import clientPromise from "@/lib/mongodb";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/*
 * ================================================
 * GET ONE CONVERSATION
 * ================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { isAuthenticated, userId } =
      await auth();

    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: "Invalid conversation ID.",
        },
        {
          status: 400,
        }
      );
    }

    const client = await clientPromise;

    const db = client.db(
      process.env.MONGODB_DB || "quantum"
    );

    const conversation =
      await db
        .collection("conversations")
        .findOne({
          _id: new ObjectId(id),
          userId,
        });

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            "Conversation not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      ...conversation,
      _id: conversation._id.toString(),
    });
  } catch (error) {
    console.error(
      "GET CONVERSATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load conversation.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * ================================================
 * DELETE CONVERSATION
 * ================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { isAuthenticated, userId } =
      await auth();

    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: "Invalid conversation ID.",
        },
        {
          status: 400,
        }
      );
    }

    const client = await clientPromise;

    const db = client.db(
      process.env.MONGODB_DB || "quantum"
    );

    const result =
      await db
        .collection("conversations")
        .deleteOne({
          _id: new ObjectId(id),
          userId,
        });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          error:
            "Conversation not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE CONVERSATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete conversation.",
      },
      {
        status: 500,
      }
    );
  }
}