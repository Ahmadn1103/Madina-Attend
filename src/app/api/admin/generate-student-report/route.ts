import { NextRequest, NextResponse } from "next/server";
import { getActiveStudents, getAllAttendance } from "@/lib/firestore";
import type { AttendanceRecord } from "@/lib/firestore";

/**
 * Generate a custom report for a specific student
 * Shows all attendance records and statistics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, studentName } = body;

    if (!studentId && !studentName) {
      return NextResponse.json(
        { status: "error", message: "Student ID or name is required" },
        { status: 400 }
      );
    }

    // Get all attendance records
    const allAttendance = await getAllAttendance();

    // Filter by student
    let studentAttendance: AttendanceRecord[];
    if (studentId) {
      studentAttendance = allAttendance.filter(
        (record) => record.studentId === studentId
      );
    } else {
      studentAttendance = allAttendance.filter(
        (record) =>
          record.studentName.toLowerCase().includes(studentName.toLowerCase())
      );
    }

    if (studentAttendance.length === 0) {
      return NextResponse.json({
        status: "warning",
        message: "No attendance records found for this student",
        data: {
          totalRecords: 0,
          studentName: studentName || "Unknown",
        },
      });
    }

    // Calculate statistics
    const totalCheckins = studentAttendance.length;
    const totalCheckouts = studentAttendance.filter((r) => r.checkOutTime).length;
    const lateCheckins = studentAttendance.filter((r) => r.isLate).length;
    const onTimeCheckins = totalCheckins - lateCheckins;
    const totalLateMinutes = studentAttendance
      .filter((r) => r.lateMinutes)
      .reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
    const totalLateHours = (totalLateMinutes / 60).toFixed(2);

    const weekendCheckins = studentAttendance.filter(
      (r) => r.classType === "weekend"
    ).length;
    const weekdayCheckins = studentAttendance.filter(
      (r) => r.classType === "weekday"
    ).length;

    // Group by week
    const weeklyBreakdown: { [key: number]: number } = {};
    studentAttendance.forEach((record) => {
      weeklyBreakdown[record.weekNumber] =
        (weeklyBreakdown[record.weekNumber] || 0) + 1;
    });

    // Sort records by date (most recent first)
    const sortedRecords = studentAttendance.sort((a, b) => {
      const dateA = a.checkInTime.toDate();
      const dateB = b.checkInTime.toDate();
      return dateB.getTime() - dateA.getTime();
    });

    // Format for response
    const formattedRecords = sortedRecords.map((record) => ({
      date: record.date,
      checkInTime: record.checkInTime.toDate().toLocaleString("en-US", { timeZone: "America/New_York", hour12: true }),
      checkOutTime: record.checkOutTime
        ? record.checkOutTime.toDate().toLocaleString("en-US", { timeZone: "America/New_York", hour12: true })
        : null,
      classType: record.classType,
      status: record.isLate ? "Late" : "On Time",
      lateMinutes: record.lateMinutes || 0,
      weekNumber: record.weekNumber,
    }));

    return NextResponse.json({
      status: "success",
      data: {
        studentName: sortedRecords[0].studentName,
        studentId: sortedRecords[0].studentId,
        summary: {
          totalCheckins,
          totalCheckouts,
          lateCheckins,
          onTimeCheckins,
          totalLateMinutes,
          totalLateHours: parseFloat(totalLateHours),
          weekendCheckins,
          weekdayCheckins,
          averageLateMinutes:
            lateCheckins > 0 ? Math.round(totalLateMinutes / lateCheckins) : 0,
        },
        weeklyBreakdown,
        records: formattedRecords,
      },
    });
  } catch (error) {
    console.error("Error generating student report:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to generate report" },
      { status: 500 }
    );
  }
}
