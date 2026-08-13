import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { tvly } from "@/lib/tavily";

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const result = await tvly.search(query, {
      search_depth: "basic",
      max_results: 5,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Search failed." },
      { status: 500 }
    );
  }
}