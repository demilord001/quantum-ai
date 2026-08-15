import {
  NextRequest,
  NextResponse,
} from "next/server";

import { ObjectId } from "mongodb";

import {
  auth,
} from "@clerk/nextjs/server";

import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/* =========================================================
   AUTH
========================================================= */

async function getAuthenticatedUser() {
  const {
    isAuthenticated,
    userId,
  } = await auth();

  if (
    !isAuthenticated ||
    !userId
  ) {
    return null;
  }

  return userId;
}

/* =========================================================
   DATABASE
========================================================= */

async function getConversationsCollection() {
  const client =
    await clientPromise;

  const db =
    client.db(
      process.env.MONGODB_DB ||
        "quantum"
    );

  return db.collection(
    "conversations"
  );
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const userId =
      await getAuthenticatedUser();

    if (!userId) {
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

    const { id } =
      await context.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid conversation ID.",
        },
        {
          status: 400,
        }
      );
    }

    const conversations =
      await getConversationsCollection();

    const conversation =
      await conversations.findOne(
        {
          _id:
            new ObjectId(id),

          /*
           * This is critical:
           * users can only read their
           * own conversations.
           */
          userId,
        }
      );

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
      _id:
        conversation._id.toString(),

      title:
        conversation.title ||
        "New conversation",

      messages:
        Array.isArray(
          conversation.messages
        )
          ? conversation.messages
          : [],

      createdAt:
        conversation.createdAt,

      updatedAt:
        conversation.updatedAt,
    });
  } catch (error) {
    console.error(
      "GET CONVERSATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
            Error
            ? error.message
            : "Failed to load conversation.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   PATCH / RENAME
========================================================= */

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId =
      await getAuthenticatedUser();

    if (!userId) {
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

    const { id } =
      await context.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid conversation ID.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const title =
      String(
        body?.title || ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Conversation title cannot be empty.",
        },
        {
          status: 400,
        }
      );
    }

    const conversations =
      await getConversationsCollection();

    const result =
      await conversations.updateOne(
        {
          _id:
            new ObjectId(id),

          /*
           * User ownership check.
           */
          userId,
        },
        {
          $set: {
            title,

            updatedAt:
              new Date(),
          },
        }
      );

    if (
      result.matchedCount ===
      0
    ) {
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
      title,
    });
  } catch (error) {
    console.error(
      "RENAME CONVERSATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
            Error
            ? error.message
            : "Failed to rename conversation.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   DELETE
========================================================= */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const userId =
      await getAuthenticatedUser();

    if (!userId) {
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

    const { id } =
      await context.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid conversation ID.",
        },
        {
          status: 400,
        }
      );
    }

    const conversations =
      await getConversationsCollection();

    const result =
      await conversations.deleteOne(
        {
          _id:
            new ObjectId(id),

          /*
           * Again, never allow a user
           * to delete another user's chat.
           */
          userId,
        }
      );

    if (
      result.deletedCount ===
      0
    ) {
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
      deletedId: id,
    });
  } catch (error) {
    console.error(
      "DELETE CONVERSATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
            Error
            ? error.message
            : "Failed to delete conversation.",
      },
      {
        status: 500,
      }
    );
  }
}