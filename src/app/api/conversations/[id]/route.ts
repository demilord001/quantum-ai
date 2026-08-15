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
   AUTH HELPER
========================================================= */

async function requireUser() {
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
   DATABASE HELPER
========================================================= */

async function getCollection() {
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
   GET ONE CONVERSATION
========================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

    const userId =
      await requireUser();

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

    /* ----------------------------------------------
       PARAMS
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       DATABASE
    ---------------------------------------------- */

    const conversations =
      await getCollection();

    const conversation =
      await conversations.findOne(
        {
          _id:
            new ObjectId(id),

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

    /* ----------------------------------------------
       RESPONSE
    ---------------------------------------------- */

    return NextResponse.json({
      _id:
        conversation._id.toString(),

      userId:
        conversation.userId,

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
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

    const userId =
      await requireUser();

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

    /* ----------------------------------------------
       PARAMS
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       BODY
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       DATABASE
    ---------------------------------------------- */

    const conversations =
      await getCollection();

    /*
     * IMPORTANT:
     *
     * userId is included in the query.
     *
     * This prevents one user from renaming
     * another user's conversation even if they
     * somehow know its ObjectId.
     */

    const result =
      await conversations.updateOne(
        {
          _id:
            new ObjectId(id),

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

    /* ----------------------------------------------
       RESPONSE
    ---------------------------------------------- */

    return NextResponse.json({
      success: true,
      title,
    });
  } catch (error) {
    console.error(
      "PATCH CONVERSATION ERROR:",
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
    /* ----------------------------------------------
       AUTH
    ---------------------------------------------- */

    const userId =
      await requireUser();

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

    /* ----------------------------------------------
       PARAMS
    ---------------------------------------------- */

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

    /* ----------------------------------------------
       DATABASE
    ---------------------------------------------- */

    const conversations =
      await getCollection();

    /*
     * Again, userId is part of the deletion
     * filter.
     */

    const result =
      await conversations.deleteOne(
        {
          _id:
            new ObjectId(id),

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

    /* ----------------------------------------------
       RESPONSE
    ---------------------------------------------- */

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