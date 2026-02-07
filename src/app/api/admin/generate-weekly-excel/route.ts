import { NextRequest, NextResponse } from "next/server";
import { getActiveStudents, getAttendanceByWeek } from "@/lib/firestore";
import { calculateWeekNumber } from "@/lib/attendanceLogic";

/**
 * Get weekly report data for Excel export
 * Returns data that can be used by the client to generate Excel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekNumber } = body;

    if (!weekNumber || weekNumber < 1) {
      return NextResponse.json(
        { status: "error", message: "Invalid week number" },
        { status: 400 }
      );
    }

    // Get all students
    const students = await getActiveStudents();

    // Get attendance records for the week
    const attendanceRecords = await getAttendanceByWeek(weekNumber);

    if (attendanceRecords.length === 0) {
      return NextResponse.json({
        status: "warning",
        message: "No attendance records found for this week",
      });
    }

    // Calculate date range
    const startDate = attendanceRecords[0]?.date || "";
    const endDate =
      attendanceRecords[attendanceRecords.length - 1]?.date || startDate;

    // Format records for Excel export
    const formattedRecords = attendanceRecords.map((record) => {
      // Handle Timestamp objects properly
      const checkInTime = record.checkInTime?.toDate ? record.checkInTime.toDate() : new Date(record.checkInTime as any);
      const checkOutTime = record.checkOutTime 
        ? (record.checkOutTime?.toDate ? record.checkOutTime.toDate() : new Date(record.checkOutTime as any))
        : null;

      return {
        studentId: record.studentId,
        studentName: record.studentName,
        date: record.date,
        checkInTime: checkInTime.toISOString(),
        checkOutTime: checkOutTime ? checkOutTime.toISOString() : null,
        classType: record.classType,
        isLate: record.isLate,
        lateMinutes: record.lateMinutes || 0,
        weekNumber: record.weekNumber,
      };
    });

    const formattedStudents = students.map((student) => ({
      id: student.id,
      name: student.name,
      classType: student.classType,
    }));

    return NextResponse.json({
      status: "success",
      data: {
        weekNumber,
        startDate,
        endDate,
        students: formattedStudents,
        attendanceRecords: formattedRecords,
      },
    });
  } catch (error) {
    console.error("Error fetching weekly data:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch weekly data" },
      { status: 500 }
    );
  }
}
