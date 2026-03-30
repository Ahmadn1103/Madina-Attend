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

/** Weekend class (Eastern Time): single block */
export const WEEKEND_CLASS_SCHEDULE: ClassSchedule = {
  start: "11:00", // 11:00 AM ET
  end: "13:30", // 1:30 PM ET
  lateThresholdMinutes: 15,
  earlyLoginMinutes: 60,
};

/**
 * Minutes before session 2’s nominal start (6:30 PM) that check-in is treated as session 2
 * (so arrivals ~6:20–6:30 aren’t graded against session 1).
 */
export const WEEKDAY_SESSION2_CHECKIN_EARLY_MINUTES = 10;

/**
 * Weekday classes (Monday–Thursday; Friday off): two sessions, Eastern Time
 * Session 1: 5:30–6:30 PM · Session 2: 6:30–7:30 PM (session-2 attendance clock starts 6:20 PM)
 */
export const WEEKDAY_CLASS_SESSIONS: ClassSchedule[] = [
  {
    start: "17:30",
    end: "18:30",
    lateThresholdMinutes: 15,
    earlyLoginMinutes: 60,
  },
  {
    start: "18:30",
    end: "19:30",
    lateThresholdMinutes: 15,
    earlyLoginMinutes: 60,
  },
];

/** @deprecated Prefer WEEKEND_CLASS_SCHEDULE and WEEKDAY_CLASS_SESSIONS */
export const CLASS_SCHEDULES: Record<"weekend" | "weekday", ClassSchedule> = {
  weekend: WEEKEND_CLASS_SCHEDULE,
  weekday: WEEKDAY_CLASS_SESSIONS[0],
};

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWeekendCalendarDay(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/** Monday–Thursday only (Friday has no classes) */
function isWeekdayClassDay(dayOfWeek: number): boolean {
  return dayOfWeek >= 1 && dayOfWeek <= 4;
}

function getWeekdayLoginWindow(): { earlyOpen: number; lastEnd: number } {
  const earlyOpen = Math.min(
    ...WEEKDAY_CLASS_SESSIONS.map(
      (s) => timeToMinutes(s.start) - s.earlyLoginMinutes
    )
  );
  const lastEnd = Math.max(...WEEKDAY_CLASS_SESSIONS.map((s) => timeToMinutes(s.end)));
  return { earlyOpen, lastEnd };
}

/** Pick which weekday session determines lateness for this clock time */
function selectWeekdaySessionForCheckIn(currentMinutes: number): ClassSchedule {
  const session2NominalStart = timeToMinutes(WEEKDAY_CLASS_SESSIONS[1].start);
  const session2AttendanceStarts =
    session2NominalStart - WEEKDAY_SESSION2_CHECKIN_EARLY_MINUTES;
  if (currentMinutes < session2AttendanceStarts) {
    return WEEKDAY_CLASS_SESSIONS[0];
  }
  return WEEKDAY_CLASS_SESSIONS[1];
}

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
 * Coarse calendar grouping: Sat–Sun → "weekend", Mon–Fri → "weekday".
 * Friday has no classes; use validateLogin for eligibility.
 */
export function determineClassType(date?: Date): "weekend" | "weekday" {
  const easternDate = getEasternTime(date);
  const dayOfWeek = easternDate.getDay();

  if (typeof window === "undefined") {
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const label = isWeekendCalendarDay(dayOfWeek)
      ? "weekend"
      : "weekday";
    console.log(
      `[determineClassType] Eastern: ${dayNames[dayOfWeek]} (day=${dayOfWeek}), Type: ${label}`
    );
  }

  return isWeekendCalendarDay(dayOfWeek) ? "weekend" : "weekday";
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
 * - Weekday classes: Monday–Thursday only (Friday off), two sessions (5:30–6:30 PM and 6:30–7:30 PM ET)
 * - Weekend classes: Saturday–Sunday, 11:00 AM–1:30 PM ET
 * - Login opens 1 hour before the first session of the day; closes after the last session ends
 * - Weekday session 2 uses a 10-minute-early check-in boundary (6:20 PM ET) vs session 1; lateness is still vs nominal class starts (5:30 / 6:30)
 * - All times use Eastern Time (America/New_York)
 * 
 * @param studentClassType - The class type assigned to the student
 * @param loginTime - Optional Date object (defaults to current time)
 * @returns LoginValidationResult object with validation details
 */
function formatTimeHHMMForDisplay(hhmm: string): string {
  const [hourStr, minStr] = hhmm.split(":");
  const startHourNum = parseInt(hourStr, 10);
  const startMin = minStr;
  return startHourNum >= 12
    ? `${startHourNum === 12 ? 12 : startHourNum - 12}:${startMin} PM`
    : `${startHourNum === 0 ? 12 : startHourNum}:${startMin} AM`;
}

export function validateLogin(
  studentClassType: ClassType,
  loginTime?: Date
): LoginValidationResult {
  const easternTime = getEasternTime(loginTime);
  const dayOfWeek = easternTime.getDay();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayName = dayNames[dayOfWeek];

  const onWeekendClassDay = isWeekendCalendarDay(dayOfWeek);
  const onWeekdayClassDay = isWeekdayClassDay(dayOfWeek);

  if (!onWeekendClassDay && !onWeekdayClassDay) {
    return {
      allowed: false,
      reason: `There are no classes today (${dayName}). Weekday sessions run Monday–Thursday, 5:30–6:30 PM and 6:30–7:30 PM ET. Weekend classes are Saturday–Sunday, 11:00 AM–1:30 PM ET. Fridays are off.`,
      dayType: "weekday",
      easternTime,
    };
  }

  const currentDayType: "weekend" | "weekday" = onWeekendClassDay ? "weekend" : "weekday";

  const canAttend = canAttendClass(studentClassType, currentDayType);

  if (!canAttend) {
    let reason = "";
    if (studentClassType === "weekend") {
      reason = `You are registered for WEEKEND classes only (Saturday & Sunday, 11:00 AM–1:30 PM ET). Today is ${dayName}. Please come back on a weekend class day.`;
    } else if (studentClassType === "weekday") {
      reason = `You are registered for WEEKDAY classes (Monday–Thursday, two sessions: 5:30–6:30 PM and 6:30–7:30 PM ET; Fridays off). Today is ${dayName}. Please come back on a weekday class day.`;
    } else {
      reason = `You are registered for ${studentClassType} classes. Today does not match your schedule.`;
    }

    return {
      allowed: false,
      reason,
      dayType: currentDayType,
      easternTime,
    };
  }

  const currentMinutes = dateToMinutes(easternTime);

  if (currentDayType === "weekend") {
    const schedule = WEEKEND_CLASS_SCHEDULE;
    const classStartMinutes = timeToMinutes(schedule.start);
    const classEndMinutes = timeToMinutes(schedule.end);
    const earlyOpen = classStartMinutes - schedule.earlyLoginMinutes;
    const lateThresholdMinutes = classStartMinutes + schedule.lateThresholdMinutes;
    const displayTime = formatTimeHHMMForDisplay(schedule.start);

    if (currentMinutes < earlyOpen) {
      const minutesUntilEarlyLogin = earlyOpen - currentMinutes;
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
        reason: `Login opens 1 hour before class starts (${displayTime} ET). Please try again in ${timeMessage}.`,
        dayType: currentDayType,
        easternTime,
      };
    }

    if (currentMinutes >= classEndMinutes) {
      return {
        allowed: false,
        reason: "Class has already ended. Login is not allowed after class end time.",
        dayType: currentDayType,
        easternTime,
      };
    }

    if (currentMinutes >= lateThresholdMinutes) {
      const minutesLate = currentMinutes - classStartMinutes;
      return {
        allowed: true,
        status: "late",
        dayType: currentDayType,
        minutesLate,
        easternTime,
      };
    }

    return {
      allowed: true,
      status: "on_time",
      dayType: currentDayType,
      minutesLate: 0,
      easternTime,
    };
  }

  // Weekday: two sessions (Mon–Thu), shared login window
  const { earlyOpen, lastEnd } = getWeekdayLoginWindow();
  const schedule = selectWeekdaySessionForCheckIn(currentMinutes);
  const classStartMinutes = timeToMinutes(schedule.start);
  const lateThresholdMinutes = classStartMinutes + schedule.lateThresholdMinutes;
  const firstStartDisplay = formatTimeHHMMForDisplay(WEEKDAY_CLASS_SESSIONS[0].start);

  if (currentMinutes < earlyOpen) {
    const minutesUntilEarlyLogin = earlyOpen - currentMinutes;
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
      reason: `Login opens 1 hour before the first session (${firstStartDisplay} ET). Please try again in ${timeMessage}.`,
      dayType: currentDayType,
      easternTime,
    };
  }

  if (currentMinutes >= lastEnd) {
    return {
      allowed: false,
      reason: "Class has already ended. Login is not allowed after the last session ends (7:30 PM ET).",
      dayType: currentDayType,
      easternTime,
    };
  }

  if (currentMinutes >= lateThresholdMinutes) {
    const minutesLate = currentMinutes - classStartMinutes;
    return {
      allowed: true,
      status: "late",
      dayType: currentDayType,
      minutesLate,
      easternTime,
    };
  }

  return {
    allowed: true,
    status: "on_time",
    dayType: currentDayType,
    minutesLate: 0,
    easternTime,
  };
}

/**
 * Calculate if student is late and by how many minutes
 * Uses Eastern Time for consistency
 */
export function calculateLateStatus(
  checkInTime: Date,
  classType: "weekend" | "weekday"
): { isLate: boolean; lateMinutes: number | null } {
  const easternTime = getEasternTime(checkInTime);
  const checkInMinutes = dateToMinutes(easternTime);

  const schedule =
    classType === "weekend"
      ? WEEKEND_CLASS_SCHEDULE
      : selectWeekdaySessionForCheckIn(checkInMinutes);

  const startMinutes = timeToMinutes(schedule.start);
  const lateThresholdMinutes = startMinutes + schedule.lateThresholdMinutes;

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
  // "both" may check in on Sat–Sun (weekend schedule) and Mon–Thu (weekday schedule).
  if (studentClassType === "both") {
    return true;
  }
  // Weekday students can also attend weekend classes
  if (studentClassType === "weekday" && sessionClassType === "weekend") {
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
