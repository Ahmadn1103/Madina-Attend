import { NextRequest, NextResponse } from "next/server";

/**
 * Admin Login API Route
 * Securely validates admin password on the server side
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    // Get admin password from environment variable (server-side only)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!password) {
      return NextResponse.json(
        { status: "error", message: "Password is required" },
        { status: 400 }
      );
    }

    // Verify password
    if (password === ADMIN_PASSWORD) {
      // In production, consider using JWT tokens or sessions
      return NextResponse.json({
        status: "success",
        message: "Authentication successful",
        // For now, we'll use a simple token (in production, use JWT)
        token: Buffer.from(`admin:${Date.now()}`).toString("base64"),
      });
    } else {
      return NextResponse.json(
        { status: "error", message: "Incorrect password" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error in admin login:", error);
    return NextResponse.json(
      { status: "error", message: "Authentication failed" },
      { status: 500 }
    );
  }
}
