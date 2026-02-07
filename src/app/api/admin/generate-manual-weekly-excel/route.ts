import { NextRequest, NextResponse } from "next/server";
import { getActiveStudents, getAttendanceByDateRange } from "@/lib/firestore";
import { calculateWeekNumber } from "@/lib/attendanceLogic";

/**
 * Generate Excel data for manual weekly report by date range
 * Returns data that can be used by the client to generate Excel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { status: "error", message: "Start date and end date are required" },
        { status: 400 }
      );
    }

    console.log(`📊 Generating manual Excel report for ${startDate} to ${endDate}`);

    // Get all students
    const students = await getActiveStudents();

    // Get attendance records for the date range
    const attendanceRecords = await getAttendanceByDateRange(startDate, endDate);

    if (attendanceRecords.length === 0) {
      return NextResponse.json({
        status: "warning",
        message: "No attendance records found for this date range",
      });
    }

    // Calculate week number from the first record or start date
    const weekNumber = attendanceRecords.length > 0 
      ? attendanceRecords[0].weekNumber 
      : calculateWeekNumber(new Date(startDate));

    // Format records for Excel export
    const formattedRecords = attendanceRecords.map((record) => ({
      studentId: record.studentId,
      studentName: record.studentName,
      date: record.date,
      checkInTime: record.checkInTime.toDate().toISOString(),
      checkOutTime: record.checkOutTime
        ? record.checkOutTime.toDate().toISOString()
        : null,
      classType: record.classType,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes || 0,
      weekNumber: record.weekNumber,
    }));

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
