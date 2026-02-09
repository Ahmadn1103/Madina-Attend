/**
 * Attendance Login Logic - Usage Demo
 * 
 * This file demonstrates how to use the validateLogin function
 * to enforce attendance rules based on class type and timing.
 */

import { validateLogin, type ClassType, type LoginValidationResult } from "./attendanceLogic";

/**
 * Example: Validate login for a weekday student
 */
function demonstrateWeekdayLogin() {
  console.log("=== Weekday Student Login Demo ===\n");
  
  // Example 1: Weekday student logging in on Monday at 5:00 PM ET (30 minutes before class)
  const weekdayStudent: ClassType = "weekday";
  const mondayAt5PM = new Date("2026-02-09T17:00:00-05:00"); // Monday, 5:00 PM ET
  
  const result1 = validateLogin(weekdayStudent, mondayAt5PM);
  console.log("Monday at 5:00 PM ET (30 min before class):");
  console.log(result1);
  // Expected: { allowed: true, status: "on_time", dayType: "weekday", minutesLate: 0 }
  
  // Example 2: Weekday student logging in on Monday at 3:30 PM ET (too early)
  const mondayAt3_30PM = new Date("2026-02-09T15:30:00-05:00"); // Monday, 3:30 PM ET
  
  const result2 = validateLogin(weekdayStudent, mondayAt3_30PM);
  console.log("\nMonday at 3:30 PM ET (too early):");
  console.log(result2);
  // Expected: { allowed: false, reason: "Login opens 1 hour before class...", dayType: "weekday" }
  
  // Example 3: Weekday student logging in on Monday at 5:50 PM ET (20 minutes late)
  const mondayAt5_50PM = new Date("2026-02-09T17:50:00-05:00"); // Monday, 5:50 PM ET
  
  const result3 = validateLogin(weekdayStudent, mondayAt5_50PM);
  console.log("\nMonday at 5:50 PM ET (20 min late):");
  console.log(result3);
  // Expected: { allowed: true, status: "late", dayType: "weekday", minutesLate: 20 }
  
  // Example 4: Weekday student trying to login on Saturday (wrong day)
  const saturdayAt5PM = new Date("2026-02-08T17:00:00-05:00"); // Saturday, 5:00 PM ET
  
  const result4 = validateLogin(weekdayStudent, saturdayAt5PM);
  console.log("\nSaturday at 5:00 PM ET (wrong day):");
  console.log(result4);
  // Expected: { allowed: false, reason: "You are registered for weekday classes...", dayType: "weekend" }
}

/**
 * Example: Validate login for a weekend student
 */
function demonstrateWeekendLogin() {
  console.log("\n\n=== Weekend Student Login Demo ===\n");
  
  // Example 1: Weekend student logging in on Saturday at 11:30 AM ET (30 minutes before class)
  const weekendStudent: ClassType = "weekend";
  const saturdayAt11_30AM = new Date("2026-02-08T11:30:00-05:00"); // Saturday, 11:30 AM ET
  
  const result1 = validateLogin(weekendStudent, saturdayAt11_30AM);
  console.log("Saturday at 11:30 AM ET (30 min before class):");
  console.log(result1);
  // Expected: { allowed: true, status: "on_time", dayType: "weekend", minutesLate: 0 }
  
  // Example 2: Weekend student logging in on Saturday at 10:30 AM ET (too early)
  const saturdayAt10_30AM = new Date("2026-02-08T10:30:00-05:00"); // Saturday, 10:30 AM ET
  
  const result2 = validateLogin(weekendStudent, saturdayAt10_30AM);
  console.log("\nSaturday at 10:30 AM ET (too early):");
  console.log(result2);
  // Expected: { allowed: false, reason: "Login opens 1 hour before class...", dayType: "weekend" }
  
  // Example 3: Weekend student logging in on Saturday at 12:20 PM ET (20 minutes late)
  const saturdayAt12_20PM = new Date("2026-02-08T12:20:00-05:00"); // Saturday, 12:20 PM ET
  
  const result3 = validateLogin(weekendStudent, saturdayAt12_20PM);
  console.log("\nSaturday at 12:20 PM ET (20 min late):");
  console.log(result3);
  // Expected: { allowed: true, status: "late", dayType: "weekend", minutesLate: 20 }
  
  // Example 4: Weekend student trying to login on Monday (wrong day)
  const mondayAt12PM = new Date("2026-02-09T12:00:00-05:00"); // Monday, 12:00 PM ET
  
  const result4 = validateLogin(weekendStudent, mondayAt12PM);
  console.log("\nMonday at 12:00 PM ET (wrong day):");
  console.log(result4);
  // Expected: { allowed: false, reason: "You are registered for weekend classes...", dayType: "weekday" }
}

/**
 * Example: Validate login for a "both" student (can attend any class)
 */
function demonstrateBothClassLogin() {
  console.log("\n\n=== Both Classes Student Login Demo ===\n");
  
  const bothStudent: ClassType = "both";
  
  // Can attend weekday classes
  const mondayAt5PM = new Date("2026-02-09T17:00:00-05:00");
  const result1 = validateLogin(bothStudent, mondayAt5PM);
  console.log("Monday at 5:00 PM ET (weekday class):");
  console.log(result1);
  // Expected: { allowed: true, status: "on_time", dayType: "weekday", minutesLate: 0 }
  
  // Can attend weekend classes
  const saturdayAt11_30AM = new Date("2026-02-08T11:30:00-05:00");
  const result2 = validateLogin(bothStudent, saturdayAt11_30AM);
  console.log("\nSaturday at 11:30 AM ET (weekend class):");
  console.log(result2);
  // Expected: { allowed: true, status: "on_time", dayType: "weekend", minutesLate: 0 }
}

/**
 * Run all demos
 */
export function runAllDemos() {
  demonstrateWeekdayLogin();
  demonstrateWeekendLogin();
  demonstrateBothClassLogin();
}

// Uncomment to run demos
// runAllDemos();
