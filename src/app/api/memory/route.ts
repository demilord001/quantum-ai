import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const client = await clientPromise;

  const db = client.db(
    process.env.MONGODB_DB || "quantum"
  );

  const memories = await db
    .collection("memories")
    .find({
      userId: user.id,
    })
    .sort({
      createdAt: -1,
    })
    .limit(20)
    .toArray();

  return NextResponse.json(memories);
}