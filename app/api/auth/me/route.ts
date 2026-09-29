import { type NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, getCurrentUser } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    const token = await getTokenFromRequest(req); // Ensure getTokenFromRequest is async
    const user = await getCurrentUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);

    return NextResponse.json(
      { error: "An error occurred while fetching user data" },
      { status: 500 }
    );
  }
}