import { NextRequest, NextResponse } from "next/server";
import {
  searchStudents,
  getTodayAttendance,
  logCheckIn,
  logCheckOut,
  type Student,
} from "@/lib/firestore";
import { calculateWeekNumber, determineClassType, checkIfLate, calculateLateMinutes } from "@/lib/attendanceLogic";

export async function POST(request: NextRequest) {
  console.log("\n🔵 === New Check-In Request ===");
  
  try {
    const body = await request.json();
    const { name, action } = body;
    
    console.log("📥 Request data:", { name, action });

    if (!name || !name.trim()) {
      return NextResponse.json(
        { status: "error", message: "Student name is required" },
        { status: 400 }
      );
    }

    if (!action || !["checkin", "checkout", "IN", "OUT"].includes(action)) {
      return NextResponse.json(
        { status: "error", message: "Invalid action. Use 'checkin' or 'checkout'" },
        { status: 400 }
      );
    }

    const actionNormalized = action === "checkin" || action === "IN" ? "checkin" : "checkout";
    const studentName = name.trim();

    // Search for the student
    console.log(`🔍 Searching for student: "${studentName}"`);
    const students = await searchStudents(studentName);

    if (students.length === 0) {
      console.log("❌ Student not found");
      return NextResponse.json(
        { 
          status: "error", 
          message: `Student "${studentName}" not found. Please check the spelling or add them to the roster first.` 
        },
        { status: 404 }
      );
    }

    // Use the first match
    const student = students[0];
    console.log(`✅ Student found: ${student.name} (${student.id})`);

    // Get today's date and week number
    const now = new Date();
    const weekNumber = calculateWeekNumber(now);
    const classType = determineClassType(now);

    console.log(`📅 Date: ${now.toLocaleDateString()}, Week: ${weekNumber}, Class: ${classType}`);

    if (actionNormalized === "checkin") {
      // Check if already checked in today
      const existingAttendance = await getTodayAttendance(student.id!);
      
      if (existingAttendance) {
        console.log("⚠️ Already checked in today");
        return NextResponse.json(
          { 
            status: "warning", 
            message: `${student.name} has already checked in today at ${existingAttendance.checkInTime.toDate().toLocaleTimeString()}`,
            data: {
              studentName: student.name,
              checkInTime: existingAttendance.checkInTime.toDate().toISOString(),
              alreadyCheckedIn: true
            }
          },
          { status: 200 }
        );
      }

      // Check if student is late
      const isLate = checkIfLate(now, classType);
      const lateMinutes = isLate ? calculateLateMinutes(now, classType) : null;

      console.log(`⏰ Late status: ${isLate ? `YES (${lateMinutes} mins)` : "NO"}`);

      // Log the check-in
      const attendanceId = await logCheckIn(
        student.id!,
        student.name,
        student.classType,
        weekNumber,
        isLate,
        lateMinutes
      );

      console.log(`✅ Check-in logged successfully (ID: ${attendanceId})`);

      return NextResponse.json({
        status: "success",
        message: isLate 
          ? `${student.name} checked in ${lateMinutes} minutes late`
          : `${student.name} checked in on time`,
        data: {
          studentName: student.name,
          studentId: student.id,
          attendanceId,
          checkInTime: now.toISOString(),
          isLate,
          lateMinutes,
          classType,
          weekNumber,
        },
      });

    } else {
      // CHECKOUT
      const existingAttendance = await getTodayAttendance(student.id!);
      
      if (!existingAttendance) {
        console.log("❌ No check-in found for today");
        return NextResponse.json(
          { 
            status: "error", 
            message: `${student.name} has not checked in today. Please check in first.` 
          },
          { status: 400 }
        );
      }

      if (existingAttendance.checkOutTime) {
        console.log("⚠️ Already checked out today");
        return NextResponse.json(
          { 
            status: "warning", 
            message: `${student.name} has already checked out today at ${existingAttendance.checkOutTime.toDate().toLocaleTimeString()}`,
            data: {
              studentName: student.name,
              checkOutTime: existingAttendance.checkOutTime.toDate().toISOString(),
              alreadyCheckedOut: true
            }
          },
          { status: 200 }
        );
      }

      // Log the check-out
      await logCheckOut(existingAttendance.id!);

      console.log(`✅ Check-out logged successfully`);

      return NextResponse.json({
        status: "success",
        message: `${student.name} checked out successfully`,
        data: {
          studentName: student.name,
          studentId: student.id,
          attendanceId: existingAttendance.id,
          checkInTime: existingAttendance.checkInTime.toDate().toISOString(),
          checkOutTime: now.toISOString(),
        },
      });
    }
    
  } catch (error) {
    console.error("\n❌ === API Route Error ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    console.error("========================\n");
    
    return NextResponse.json(
      { 
        status: "error", 
        message: error instanceof Error ? error.message : "Failed to log attendance" 
      },
      { status: 500 }
    );
  }
}
