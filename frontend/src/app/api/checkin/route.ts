import { NextRequest, NextResponse } from "next/server";

const SHEETS_API_URL = process.env.NEXT_PUBLIC_SHEETS_API_URL;

export async function POST(request: NextRequest) {
  console.log("\n🔵 === New Check-In Request ===");
  
  try {
    const body = await request.json();
    const { name, action } = body;
    
    console.log("📥 Request data:", { name, action });

    const actionUpper = action === "checkin" ? "IN" : action === "checkout" ? "OUT" : action?.toUpperCase();

    const payload = {
      name: name?.trim() || "",
      action: actionUpper,
      userAgent: request.headers.get("user-agent") || undefined,
    };

    if (!SHEETS_API_URL) {
      console.error("❌ SHEETS_API_URL not configured!");
      return NextResponse.json(
        { status: "error", message: "Sheets API URL not configured" },
        { status: 500 }
      );
    }

    console.log("🔗 Calling Google Apps Script:", SHEETS_API_URL);
    console.log("📤 Payload:", payload);

    const response = await fetch(SHEETS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("📨 Response received:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get("content-type")
    });

    const data = await response.json();
    console.log("📦 Response data:", data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("\n❌ === API Route Error ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    console.error("========================\n");
    
    return NextResponse.json(
      { status: "error", message: "Failed to log attendance" },
      { status: 500 }
    );
  }
}
