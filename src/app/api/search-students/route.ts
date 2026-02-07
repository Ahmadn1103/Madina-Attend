import { NextRequest, NextResponse } from "next/server";
import { searchStudents } from "@/lib/firestore";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query");

    if (!query || query.trim().length < 1) {
      return NextResponse.json({
        status: "error",
        message: "Query must be at least 1 character",
        students: [],
      });
    }

    // Search for students using the existing firestore function
    const students = await searchStudents(query.trim());

    // Filter only active students
    const activeStudents = students.filter((student) => student.active !== false);

    // Limit to top 10 results
    const limitedResults = activeStudents.slice(0, 10);

    return NextResponse.json({
      status: "success",
      students: limitedResults.map((student) => ({
        id: student.id,
        name: student.name,
        classType: student.classType,
      })),
    });
  } catch (error) {
    console.error("Error searching students:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to search students",
        students: [],
      },
      { status: 500 }
    );
  }
}
