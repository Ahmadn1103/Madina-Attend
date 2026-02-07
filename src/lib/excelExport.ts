/**
 * Excel Export Utilities
 * Generate and download Excel files for reports
 */
import * as XLSX from "xlsx";
import { formatMinutesToReadable } from "./timeFormat";

/**
 * Export student report to Excel
 */
export function exportStudentReportToExcel(reportData: any) {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  // Convert minutes to readable format
  const totalLateTime = formatMinutesToReadable(reportData.summary.totalLateMinutes);
  const averageLateTime = formatMinutesToReadable(reportData.summary.averageLateMinutes);

  const summaryData = [
    ["Student Report"],
    ["Student Name:", reportData.studentName],
    ["Student ID:", reportData.studentId],
    [],
    ["Summary Statistics"],
    ["Total Check-ins", reportData.summary.totalCheckins],
    ["On Time", reportData.summary.onTimeCheckins],
    ["Late", reportData.summary.lateCheckins],
    ["Total Late Time", totalLateTime],
    ["Average Late Time", averageLateTime],
    ["Weekend Classes", reportData.summary.weekendCheckins],
    ["Weekday Classes", reportData.summary.weekdayCheckins],
    [],
    ["Weekly Breakdown"],
    ["Week Number", "Check-ins"],
  ];

  // Add weekly breakdown data
  Object.entries(reportData.weeklyBreakdown).forEach(([week, count]) => {
    summaryData.push([`Week ${week}`, count as number]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Attendance Records Sheet
  const recordsData = [
    [
      "Date",
      "Check-in Time",
      "Check-out Time",
      "Class Type",
      "Status",
      "Late Time",
      "Week Number",
    ],
  ];

  reportData.records.forEach((record: any) => {
    recordsData.push([
      record.date,
      record.checkInTime,
      record.checkOutTime || "Not checked out",
      record.classType,
      record.status,
      record.lateMinutes ? formatMinutesToReadable(record.lateMinutes) : "-",
      record.weekNumber,
    ]);
  });

  const recordsSheet = XLSX.utils.aoa_to_sheet(recordsData);
  XLSX.utils.book_append_sheet(workbook, recordsSheet, "Attendance Records");

  // Format column widths
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
  recordsSheet["!cols"] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
  ];

  // Generate filename with student name and date
  const filename = `${reportData.studentName.replace(/\s+/g, "_")}_Report_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;

  // Download file
  XLSX.writeFile(workbook, filename);
}

/**
 * Export weekly report to Excel
 */
export function exportWeeklyReportToExcel(
  weekNumber: number,
  startDate: string,
  endDate: string,
  students: any[],
  attendanceRecords: any[]
) {
  const workbook = XLSX.utils.book_new();

  // Calculate statistics for each student
  const studentStats = students.map((student) => {
    const studentAttendance = attendanceRecords.filter(
      (record) => record.studentId === student.id
    );

    const totalClasses = studentAttendance.length;
    const lateCount = studentAttendance.filter((r) => r.isLate).length;
    const totalLateMinutes = studentAttendance
      .filter((r) => r.lateMinutes)
      .reduce((sum, r) => sum + (r.lateMinutes || 0), 0);
    const totalLateTime = formatMinutesToReadable(totalLateMinutes);
    const weekdayClasses = studentAttendance.filter(
      (r) => r.classType === "weekday"
    ).length;
    const weekendClasses = studentAttendance.filter(
      (r) => r.classType === "weekend"
    ).length;

    return {
      name: student.name,
      classType: student.classType,
      totalClasses,
      lateCount,
      onTimeCount: totalClasses - lateCount,
      totalLateTime,
      weekdayClasses,
      weekendClasses,
    };
  });

  // Summary Sheet
  const summaryData = [
    [`Weekly Attendance Report - Week ${weekNumber}`],
    [`Date Range: ${startDate} to ${endDate}`],
    [],
    [
      "Student Name",
      "Class Type",
      "Total Classes",
      "Times Late",
      "On Time",
      "Total Late Time",
      "Weekday Classes",
      "Weekend Classes",
    ],
  ];

  studentStats.forEach((stat) => {
    summaryData.push([
      stat.name,
      stat.classType,
      stat.totalClasses,
      stat.lateCount,
      stat.onTimeCount,
      stat.totalLateTime,
      stat.weekdayClasses,
      stat.weekendClasses,
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Weekday Attendance Sheet
  const weekdayRecords = attendanceRecords.filter(
    (r) => r.classType === "weekday"
  );
  const weekdayData = [
    [`Weekday Attendance - Week ${weekNumber}`],
    [`${startDate} to ${endDate}`],
    [],
    ["Date", "Student Name", "Check-in Time", "Check-out Time", "Status", "Late Time"],
  ];

  weekdayRecords.forEach((record) => {
    weekdayData.push([
      record.date,
      record.studentName,
      formatTimestamp(record.checkInTime),
      record.checkOutTime ? formatTimestamp(record.checkOutTime) : "Not checked out",
      record.isLate ? "Late" : "On Time",
      record.lateMinutes ? formatMinutesToReadable(record.lateMinutes) : "-",
    ]);
  });

  const weekdaySheet = XLSX.utils.aoa_to_sheet(weekdayData);
  XLSX.utils.book_append_sheet(workbook, weekdaySheet, "Weekday Attendance");

  // Weekend Attendance Sheet
  const weekendRecords = attendanceRecords.filter(
    (r) => r.classType === "weekend"
  );
  const weekendData = [
    [`Weekend Attendance - Week ${weekNumber}`],
    [`${startDate} to ${endDate}`],
    [],
    ["Date", "Student Name", "Check-in Time", "Check-out Time", "Status", "Late Time"],
  ];

  weekendRecords.forEach((record) => {
    weekendData.push([
      record.date,
      record.studentName,
      formatTimestamp(record.checkInTime),
      record.checkOutTime ? formatTimestamp(record.checkOutTime) : "Not checked out",
      record.isLate ? "Late" : "On Time",
      record.lateMinutes ? formatMinutesToReadable(record.lateMinutes) : "-",
    ]);
  });

  const weekendSheet = XLSX.utils.aoa_to_sheet(weekendData);
  XLSX.utils.book_append_sheet(workbook, weekendSheet, "Weekend Attendance");

  // Format column widths
  summarySheet["!cols"] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
  ];
  weekdaySheet["!cols"] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
  ];
  weekendSheet["!cols"] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
  ];

  // Generate filename
  const filename = `Week_${weekNumber}_Report_${startDate}_to_${endDate}.xlsx`;

  // Download file
  XLSX.writeFile(workbook, filename);
}

/**
 * Helper function to format timestamps
 */
function formatTimestamp(timestamp: any): string {
  if (!timestamp) return "N/A";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return "Invalid date";
  }
}
