/**
 * Attendance Logic
 * Calculate late status and week numbers
 * All times are in Eastern Time (America/New_York)
 */

export type ClassType = "weekend" | "weekday" | "both";

export interface ClassSchedule {
  start: string; // HH:MM format (24-hour)
  end: string; // HH:MM format (24-hour)
  lateThresholdMinutes: number;
  earlyLoginMinutes: number; // How many minutes before class start users can log in
}

// Class schedules configuration (Eastern Time)
export const CLASS_SCHEDULES: Record<"weekend" | "weekday", ClassSchedule> = {
  weekend: {
    start: "12:00", // 12:00 PM ET
    end: "13:30",   // 1:30 PM ET
    lateThresholdMinutes: 15,
    earlyLoginMinutes: 60, // Can log in 1 hour before
  },
  weekday: {
    start: "17:30", // 5:30 PM ET
    end: "19:30",   // 7:30 PM ET
    lateThresholdMinutes: 15,
    earlyLoginMinutes: 60, // Can log in 1 hour before
  },
};

// Timezone constant
const EASTERN_TIMEZONE = "America/New_York";

/**
 * Get current Eastern Time as a Date object
 * Always uses 24-hour format for consistency
 */
export function getEasternTime(date?: Date): Date {
  const now = date || new Date();
  
  // Convert to Eastern Time using Intl API with 24-hour format
  const easternTimeString = now.toLocaleString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Force 24-hour format
  });
  
  // Debug logging (can be removed in production)
  if (typeof window === 'undefined') { // Only log on server
    console.log(`[getEasternTime] Input UTC: ${now.toISOString()}, Eastern String: ${easternTimeString}`);
  }
  
  // Parse the string back to a Date object
  // Format: MM/DD/YYYY, HH:mm:ss (24-hour)
  const [datePart, timePart] = easternTimeString.split(", ");
  const [month, day, year] = datePart.split("/");
  const [hour, minute, second] = timePart.split(":");
  
  // Create date object in UTC to avoid timezone shifts
  const easternDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`);
  
  return easternDate;
}

/**
 * Determine if a given date/time is a weekend or weekday class
 * Uses Eastern Time (24-hour format)
 * 
 * IMPORTANT: Pass a raw UTC date here - this function converts to Eastern internally.
 * Do NOT pass an already-converted Eastern time, or the day will be wrong!
 */
export function determineClassType(date?: Date): "weekend" | "weekday" {
  const easternDate = getEasternTime(date);
  const dayOfWeek = easternDate.getDay();
  // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Debug logging (can be removed in production)
  if (typeof window === 'undefined') { // Only log on server
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    console.log(`[determineClassType] Eastern: ${dayNames[dayOfWeek]} (day=${dayOfWeek}), Type: ${isWeekend ? 'weekend' : 'weekday'}`);
  }
  
  return isWeekend ? "weekend" : "weekday";
}

/**
 * Parse time string (HH:MM) and return minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Get time in minutes since midnight for a given date
 */
function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Result object for login validation
 */
export interface LoginValidationResult {
  allowed: boolean;
  reason?: string;
  status?: "on_time" | "late";
  dayType: "weekday" | "weekend";
  minutesLate?: number;
  easternTime: Date; // The computed Eastern time, reuse to avoid extra getEasternTime calls
}

/**
 * Validate if a user can log in for attendance
 * 
 * This function enforces the following rules:
 * - Users can only log in on days that match their class type (weekday vs weekend)
 * - Login is allowed starting 1 hour before class start time
 * - Login is not allowed after class end time
 * - Users are marked "late" if they log in more than 15 minutes after class start
 * - All times are calculated in Eastern Time (America/New_York)
 * 
 * @param studentClassType - The class type assigned to the student
 * @param loginTime - Optional Date object (defaults to current time)
 * @returns LoginValidationResult object with validation details
 */
export function validateLogin(
  studentClassType: ClassType,
  loginTime?: Date
): LoginValidationResult {
  // Convert to Eastern Time once — reuse for all checks
  const easternTime = getEasternTime(loginTime);
  
  // Determine day type directly from the already-converted Eastern time
  const dayOfWeek = easternTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const currentDayType: "weekend" | "weekday" = isWeekend ? "weekend" : "weekday";
  
  // Get day name for better error messages
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[dayOfWeek];
  
  // Check if student can attend this class type
  const canAttend = canAttendClass(studentClassType, currentDayType);
  
  if (!canAttend) {
    // Provide clearer error message based on student's class type
    let reason = "";
    if (studentClassType === "weekend") {
      reason = `You are registered for WEEKEND classes only (Saturday & Sunday, 12:00 PM - 1:30 PM). Today is ${dayName}, a weekday. Please come back on the weekend.`;
    } else if (studentClassType === "weekday") {
      reason = `You are registered for WEEKDAY classes only (Monday-Friday, 5:30 PM - 7:30 PM). Today is ${dayName}, a weekend day. Please come back on a weekday.`;
    } else {
      reason = `You are registered for ${studentClassType} classes. Today is a ${currentDayType} class day.`;
    }
    
    return {
      allowed: false,
      reason,
      dayType: currentDayType,
      easternTime,
    };
  }
  
  // Get the schedule for today's class type
  const schedule = CLASS_SCHEDULES[currentDayType];
  
  // Get current time in minutes since midnight (24-hour format)
  const currentMinutes = dateToMinutes(easternTime);
  
  // Get class times in minutes since midnight
  const classStartMinutes = timeToMinutes(schedule.start);
  const classEndMinutes = timeToMinutes(schedule.end);
  const earlyLoginMinutes = classStartMinutes - schedule.earlyLoginMinutes;
  const lateThresholdMinutes = classStartMinutes + schedule.lateThresholdMinutes;
  
  // Format class start time for display (24-hour format)
  const classStartTime = schedule.start;
  const [startHour, startMin] = classStartTime.split(":");
  const startHourNum = parseInt(startHour);
  const displayTime = startHourNum >= 12 
    ? `${startHourNum === 12 ? 12 : startHourNum - 12}:${startMin} PM`
    : `${startHourNum === 0 ? 12 : startHourNum}:${startMin} AM`;
  
  // Check if it's too early to log in (more than 1 hour before class)
  if (currentMinutes < earlyLoginMinutes) {
    const minutesUntilEarlyLogin = earlyLoginMinutes - currentMinutes;
    const hours = Math.floor(minutesUntilEarlyLogin / 60);
    const minutes = minutesUntilEarlyLogin % 60;
    
    let timeMessage = "";
    if (hours > 0 && minutes > 0) {
      timeMessage = `${hours} hour${hours > 1 ? "s" : ""} and ${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else if (hours > 0) {
      timeMessage = `${hours} hour${hours > 1 ? "s" : ""}`;
    } else {
      timeMessage = `${minutes} minute${minutes > 1 ? "s" : ""}`;
    }
    
    return {
      allowed: false,
      reason: `Login opens 1 hour before class starts at ${displayTime}. Please try again in ${timeMessage}.`,
      dayType: currentDayType,
      easternTime,
    };
  }
  
  // Check if it's after class end time
  if (currentMinutes > classEndMinutes) {
    return {
      allowed: false,
      reason: "Class has already ended. Login is not allowed after class end time.",
      dayType: currentDayType,
      easternTime,
    };
  }
  
  // Login is allowed - determine if on time or late
  if (currentMinutes > lateThresholdMinutes) {
    // Student is late
    const minutesLate = currentMinutes - classStartMinutes;
    return {
      allowed: true,
      status: "late",
      dayType: currentDayType,
      minutesLate,
      easternTime,
    };
  } else {
    // Student is on time
    return {
      allowed: true,
      status: "on_time",
      dayType: currentDayType,
      minutesLate: 0,
      easternTime,
    };
  }
}

/**
 * Calculate if student is late and by how many minutes
 * Uses Eastern Time for consistency
 */
export function calculateLateStatus(
  checkInTime: Date,
  classType: "weekend" | "weekday"
): { isLate: boolean; lateMinutes: number | null } {
  const schedule = CLASS_SCHEDULES[classType];

  // Convert to Eastern Time
  const easternTime = getEasternTime(checkInTime);

  // Get the check-in time in minutes since midnight
  const checkInMinutes = dateToMinutes(easternTime);

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
