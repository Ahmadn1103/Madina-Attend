import { NextRequest, NextResponse } from "next/server";
import { getActiveStudents, getStudentById, updateStudentName } from "@/lib/firestore";

/**
 * Update an active student's name
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, name } = body;

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json(
        { status: "error", message: "Student ID is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { status: "error", message: "Name is required" },
        { status: 400 }
      );
    }

    const student = await getStudentById(studentId);
    if (!student || student.active === false) {
      return NextResponse.json(
        { status: "error", message: "Student not found or inactive" },
        { status: 404 }
      );
    }

    const trimmed = name.trim();
    const nameLower = trimmed.toLowerCase();
    const existingStudents = await getActiveStudents();
    const duplicate = existingStudents.find(
      (s) => s.id !== studentId && s.name.toLowerCase().trim() === nameLower
    );

    if (duplicate) {
      return NextResponse.json(
        {
          status: "error",
          message: `Another student is already named "${duplicate.name}". Names must be unique.`,
        },
        { status: 409 }
      );
    }

    await updateStudentName(studentId, trimmed);

    return NextResponse.json({
      status: "success",
      message: "Student updated successfully",
      studentName: trimmed,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to update student" },
      { status: 500 }
    );
  }
}
