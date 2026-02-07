/**
 * Attendance Logic
 * Calculate late status and week numbers
 */

export type ClassType = "weekend" | "weekday" | "both";

export interface ClassSchedule {
  start: string; // HH:MM format (24-hour)
  end: string; // HH:MM format (24-hour)
  lateThresholdMinutes: number;
}

// Class schedules configuration
export const CLASS_SCHEDULES: Record<"weekend" | "weekday", ClassSchedule> = {
  weekend: {
    start: "11:00",
    end: "13:30",
    lateThresholdMinutes: 15,
  },
  weekday: {
    start: "17:30",
    end: "19:30",
    lateThresholdMinutes: 15,
  },
};

/**
 * Determine if a given date/time is a weekend or weekday class
 */
export function determineClassType(date: Date = new Date()): "weekend" | "weekday" {
  const dayOfWeek = date.getDay();
  // 0 = Sunday, 6 = Saturday
  return dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday";
}

/**
 * Parse time string (HH:MM) and return minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate if student is late and by how many minutes
 */
export function calculateLateStatus(
  checkInTime: Date,
  classType: "weekend" | "weekday"
): { isLate: boolean; lateMinutes: number | null } {
  const schedule = CLASS_SCHEDULES[classType];

  // Get the check-in time in minutes since midnight
  const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();

  // Get the class start time in minutes since midnight
  const startMinutes = timeToMinutes(schedule.start);

  // Calculate the late threshold time
  const lateThresholdMinutes = startMinutes + schedule.lateThresholdMinutes;

  // If checked in after the late threshold
  if (checkInMinutes > lateThresholdMinutes) {
    const lateBy = checkInMinutes - startMinutes;
    return { isLate: true, lateMinutes: lateBy };
  }

  return { isLate: false, lateMinutes: null };
}

/**
 * Calculate week number based on system start date
 * Week 1 starts on the system start date
 */
export function calculateWeekNumber(
  date: Date = new Date(),
  systemStartDate: string = process.env.SYSTEM_START_DATE || "2026-02-06"
): number {
  const startDate = new Date(systemStartDate);
  const currentDate = new Date(date);

  // Reset to start of day for accurate comparison
  startDate.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);

  // Calculate difference in milliseconds
  const diffMs = currentDate.getTime() - startDate.getTime();

  // Convert to days
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Calculate week number (week 1 starts at day 0)
  const weekNumber = Math.floor(diffDays / 7) + 1;

  return weekNumber > 0 ? weekNumber : 1;
}

/**
 * Get the start and end dates for a given week number
 */
export function getWeekDateRange(
  weekNumber: number,
  systemStartDate: string = process.env.SYSTEM_START_DATE || "2026-02-06"
): { startDate: string; endDate: string } {
  const startDate = new Date(systemStartDate);

  // Calculate the start of the given week
  const weekStartDate = new Date(startDate);
  weekStartDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);

  // Calculate the end of the given week (6 days later)
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);

  // Format as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  return {
    startDate: formatDate(weekStartDate),
    endDate: formatDate(weekEndDate),
  };
}

/**
 * Check if a student is eligible to attend a class based on their class type
 */
export function canAttendClass(
  studentClassType: ClassType,
  sessionClassType: "weekend" | "weekday"
): boolean {
  if (studentClassType === "both") {
    return true;
  }
  return studentClassType === sessionClassType;
}

/**
 * Format late message for display
 */
export function formatLateMessage(lateMinutes: number): string {
  if (lateMinutes < 60) {
    return `${lateMinutes} minute${lateMinutes !== 1 ? "s" : ""} late`;
  }

  const hours = Math.floor(lateMinutes / 60);
  const minutes = lateMinutes % 60;

  if (minutes === 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""} late`;
  }

  return `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""} late`;
}
