import { NextRequest, NextResponse } from "next/server";
import {
  getActiveStudents,
  getStudentById,
  updateStudentProfile,
  type ClassType,
} from "@/lib/firestore";

const CLASS_TYPES: ClassType[] = ["weekend", "weekday", "both"];

/**
 * Update an active student's name and/or class type (weekend / weekday / both).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, name, classType } = body;

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json(
        { status: "error", message: "Student ID is required" },
        { status: 400 }
      );
    }

    const wantsName =
      name !== undefined && name !== null && typeof name === "string" && name.trim() !== "";
    const wantsClassType =
      classType !== undefined &&
      typeof classType === "string" &&
      CLASS_TYPES.includes(classType as ClassType);

    if (!wantsName && !wantsClassType) {
      return NextResponse.json(
        {
          status: "error",
          message: "Provide a non-empty name and/or a valid class type (weekend, weekday, both)",
        },
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

    if (wantsName) {
      const trimmed = (name as string).trim();
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
    }

    await updateStudentProfile(studentId, {
      ...(wantsName ? { name: (name as string).trim() } : {}),
      ...(wantsClassType ? { classType: classType as ClassType } : {}),
    });

    const nextName = wantsName ? (name as string).trim() : student.name;
    const nextClassType = wantsClassType ? (classType as ClassType) : student.classType;

    return NextResponse.json({
      status: "success",
      message: "Student updated successfully",
      studentName: nextName,
      classType: nextClassType,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to update student" },
      { status: 500 }
    );
  }
}
