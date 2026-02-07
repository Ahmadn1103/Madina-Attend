import { NextRequest, NextResponse } from "next/server";
import { deleteStudent } from "@/lib/firestore";

/**
 * Delete a student by ID (marks as inactive)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "Student ID is required" },
        { status: 400 }
      );
    }

    // Mark student as inactive in Firestore
    await deleteStudent(studentId);

    return NextResponse.json({
      status: "success",
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to delete student" },
      { status: 500 }
    );
  }
}
