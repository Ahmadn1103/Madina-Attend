/**
 * Report Generator
 * Generate weekly attendance reports
 */
import { AttendanceRecord, Student } from "./firestore";

export interface StudentReport {
  studentId: string;
  studentName: string;
  classType: string;
  totalClasses: number;
  timesLate: number;
  totalLateMinutes: number;
  attendancePercentage: number;
  weekdayClasses: number;
  weekendClasses: number;
}

export interface WeeklyReportData {
  weekNumber: number;
  startDate: string;
  endDate: string;
  totalSessions: number;
  studentReports: StudentReport[];
  weekdayAttendance: AttendanceRecord[];
  weekendAttendance: AttendanceRecord[];
}

/**
 * Generate weekly attendance report from attendance records
 */
export function generateWeeklyReport(
  attendanceRecords: AttendanceRecord[],
  students: Student[],
  weekNumber: number,
  startDate: string,
  endDate: string
): WeeklyReportData {
  // Separate by class type
  const weekdayAttendance = attendanceRecords.filter(
    (record) => record.classType === "weekday"
  );
  const weekendAttendance = attendanceRecords.filter(
    (record) => record.classType === "weekend"
  );

  // Group attendance by student
  const studentAttendanceMap = new Map<string, AttendanceRecord[]>();

  for (const record of attendanceRecords) {
    const studentId = record.studentId;
    if (!studentAttendanceMap.has(studentId)) {
      studentAttendanceMap.set(studentId, []);
    }
    studentAttendanceMap.get(studentId)!.push(record);
  }

  // Generate student reports
  const studentReports: StudentReport[] = [];

  for (const [studentId, records] of studentAttendanceMap.entries()) {
    const student = students.find((s) => s.id === studentId);
    const studentName = records[0]?.studentName || "Unknown";

    const timesLate = records.filter((r) => r.isLate).length;
    const totalLateMinutes = records.reduce(
      (sum, r) => sum + (r.lateMinutes || 0),
      0
    );

    const weekdayClasses = records.filter(
      (r) => r.classType === "weekday"
    ).length;
    const weekendClasses = records.filter(
      (r) => r.classType === "weekend"
    ).length;

    // Calculate attendance percentage
    // This is simplified - in a real scenario, you'd need to know the total possible classes
    const totalClasses = records.length;
    const attendancePercentage = 100; // They attended if they have a record

    studentReports.push({
      studentId,
      studentName,
      classType: student?.classType || "unknown",
      totalClasses,
      timesLate,
      totalLateMinutes,
      attendancePercentage,
      weekdayClasses,
      weekendClasses,
    });
  }

  // Sort by student name
  studentReports.sort((a, b) => a.studentName.localeCompare(b.studentName));

  return {
    weekNumber,
    startDate,
    endDate,
    totalSessions: attendanceRecords.length,
    studentReports,
    weekdayAttendance,
    weekendAttendance,
  };
}

/**
 * Format report data for Google Sheets
 */
export function formatReportForSheets(report: WeeklyReportData): {
  summaryData: any[][];
  weekdayData: any[][];
  weekendData: any[][];
} {
  // Summary sheet data
  const summaryData: any[][] = [
    ["Weekly Attendance Report"],
    [`Week ${report.weekNumber}: ${report.startDate} to ${report.endDate}`],
    [],
    ["Student Name", "Class Type", "Total Classes", "Times Late", "Late Minutes", "Weekday Classes", "Weekend Classes"],
  ];

  for (const studentReport of report.studentReports) {
    summaryData.push([
      studentReport.studentName,
      studentReport.classType,
      studentReport.totalClasses,
      studentReport.timesLate,
      studentReport.totalLateMinutes,
      studentReport.weekdayClasses,
      studentReport.weekendClasses,
    ]);
  }

  // Weekday attendance data
  const weekdayData: any[][] = [
    ["Weekday Attendance"],
    [`Week ${report.weekNumber}: ${report.startDate} to ${report.endDate}`],
    [],
    ["Date", "Student Name", "Check In Time", "Check Out Time", "Status", "Late Minutes"],
  ];

  for (const record of report.weekdayAttendance) {
    weekdayData.push([
      record.date,
      record.studentName,
      formatTimestamp(record.checkInTime),
      record.checkOutTime ? formatTimestamp(record.checkOutTime) : "Not checked out",
      record.isLate ? "Late" : "On Time",
      record.lateMinutes || "",
    ]);
  }

  // Weekend attendance data
  const weekendData: any[][] = [
    ["Weekend Attendance"],
    [`Week ${report.weekNumber}: ${report.startDate} to ${report.endDate}`],
    [],
    ["Date", "Student Name", "Check In Time", "Check Out Time", "Status", "Late Minutes"],
  ];

  for (const record of report.weekendAttendance) {
    weekendData.push([
      record.date,
      record.studentName,
      formatTimestamp(record.checkInTime),
      record.checkOutTime ? formatTimestamp(record.checkOutTime) : "Not checked out",
      record.isLate ? "Late" : "On Time",
      record.lateMinutes || "",
    ]);
  }

  return {
    summaryData,
    weekdayData,
    weekendData,
  };
}

/**
 * Format Firestore timestamp for display
 */
function formatTimestamp(timestamp: any): string {
  if (!timestamp) return "";

  let date: Date;

  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return String(timestamp);
  }

  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
