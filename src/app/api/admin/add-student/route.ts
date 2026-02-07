import { NextRequest, NextResponse } from "next/server";
import { addStudent, getActiveStudents } from "@/lib/firestore";
import type { ClassType } from "@/lib/firestore";

/**
 * Add a single student manually
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, classType } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { status: "error", message: "First name and last name are required" },
        { status: 400 }
      );
    }

    if (!classType || !["weekend", "weekday", "both"].includes(classType)) {
      return NextResponse.json(
        { status: "error", message: "Valid class type is required (weekend, weekday, or both)" },
        { status: 400 }
      );
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const fullNameLower = fullName.toLowerCase();

    // Check for duplicate names (case-insensitive, across ALL class types)
    const existingStudents = await getActiveStudents();
    const duplicate = existingStudents.find(
      (student) => student.name.toLowerCase() === fullNameLower
    );

    if (duplicate) {
      const classTypeDisplay = duplicate.classType === "both" 
        ? "Weekend & Weekday" 
        : duplicate.classType.charAt(0).toUpperCase() + duplicate.classType.slice(1);
      
      return NextResponse.json(
        { 
          status: "error", 
          message: `Student "${duplicate.name}" already exists in ${classTypeDisplay} class. Cannot add duplicate names regardless of class type.` 
        },
        { status: 409 }  // 409 Conflict
      );
    }

    // Add student to Firestore
    const studentId = await addStudent(fullName, classType as ClassType);

    return NextResponse.json({
      status: "success",
      message: "Student added successfully",
      studentId,
      studentName: fullName,
    });
  } catch (error) {
    console.error("Error adding student:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to add student" },
      { status: 500 }
    );
  }
}
