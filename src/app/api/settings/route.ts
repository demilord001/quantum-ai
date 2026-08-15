import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  auth,
} from "@clerk/nextjs/server";

import clientPromise from "@/lib/mongodb";

import {
  DEFAULT_QUANTUM_SETTINGS,
  sanitizeQuantumSettings,
} from "@/lib/quantum-settings";

export const runtime = "nodejs";

const COLLECTION =
  "userSettings";

/* =========================================================
   GET
========================================================= */

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
            "Unauthorized.",
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

    const rawSettings =
      await db
        .collection(
          COLLECTION
        )
        .findOne({
          userId,
        });

    if (!rawSettings) {
      return NextResponse.json(
        {
          settings:
            DEFAULT_QUANTUM_SETTINGS,
        }
      );
    }

    const settings =
      sanitizeQuantumSettings(
        rawSettings as Partial<
          typeof DEFAULT_QUANTUM_SETTINGS
        >
      );

    return NextResponse.json(
      {
        settings,
      }
    );
  } catch (error) {
    console.error(
      "GET SETTINGS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load settings.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(
  request: NextRequest
) {
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
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const settings =
      sanitizeQuantumSettings(
        body
      );

    const client =
      await clientPromise;

    const db =
      client.db(
        process.env.MONGODB_DB ||
          "quantum"
      );

    await db
      .collection(
        COLLECTION
      )
      .updateOne(
        {
          userId,
        },
        {
          $set: {
            userId,

            ...settings,

            updatedAt:
              new Date(),
          },

          $setOnInsert: {
            createdAt:
              new Date(),
          },
        },
        {
          upsert: true,
        }
      );

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(
      "PATCH SETTINGS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save settings.",
      },
      {
        status: 500,
      }
    );
  }
}