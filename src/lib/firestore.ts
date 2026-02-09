/**
 * Firestore Helper Functions
 * Database operations for students, attendance, and weekly sheets
 */
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QueryConstraint,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

// ============ Types ============

export type ClassType = "weekend" | "weekday" | "both";

export interface Student {
  id?: string;
  name: string;
  classType: ClassType;
  active: boolean;
  addedDate: Timestamp;
}

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  studentName: string;
  checkInTime: Timestamp;
  checkOutTime: Timestamp | null;
  classType: ClassType;
  date: string; // YYYY-MM-DD
  weekNumber: number;
  isLate: boolean;
  lateMinutes: number | null;
  status: "present" | "late";
}

export interface WeeklySheet {
  id?: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  sheetUrl: string;
  createdAt: Timestamp;
  generationType: "auto" | "manual";
}

// ============ Student Operations ============

/**
 * Add a new student to the database
 */
export async function addStudent(
  name: string,
  classType: ClassType
): Promise<string> {
  const studentData: Omit<Student, "id"> = {
    name: name.trim(),
    classType,
    active: true,
    addedDate: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, "students"), studentData);
  return docRef.id;
}

/**
 * Get all active students
 */
export async function getActiveStudents(): Promise<Student[]> {
  const q = query(
    collection(db, "students"),
    where("active", "==", true),
    orderBy("name")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Student[];
}

/**
 * Search students by first name prefix or exact full name match
 * - Partial search: "AH" matches "Ahmad Noori" but NOT "Abdirahman Osman"
 * - Full name: "Ahmad Noori" matches exactly
 */
export async function searchStudents(searchTerm: string): Promise<Student[]> {
  const allStudents = await getActiveStudents();
  const searchLower = searchTerm.toLowerCase().trim();

  if (!searchLower) {
    return allStudents;
  }

  return allStudents.filter((student) => {
    const fullNameLower = student.name.toLowerCase();
    
    // If search term contains a space, try exact full name match first
    if (searchLower.includes(' ')) {
      // Match full name exactly (for check-in with selected name)
      if (fullNameLower === searchLower) {
        return true;
      }
      // Also allow full name to start with search term (for partial full name typing)
      if (fullNameLower.startsWith(searchLower)) {
        return true;
      }
    }
    
    // Extract first name (text before first space, or entire name if no space)
    const firstName = student.name.split(' ')[0].toLowerCase();
    
    // Match only if search term matches the START of the first name
    return firstName.startsWith(searchLower);
  });
}

/**
 * Get a student by ID
 */
export async function getStudentById(studentId: string): Promise<Student | null> {
  const docRef = doc(db, "students", studentId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Student;
  }
  return null;
}

/**
 * Bulk import students
 */
export async function bulkImportStudents(
  students: Array<{ name: string; classType: ClassType }>
): Promise<{ success: number; failed: number; errors: string[]; skipped: number }> {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Get all existing students once to check for duplicates
  const existingStudents = await getActiveStudents();
  const existingNames = new Set(
    existingStudents.map(s => s.name.toLowerCase().trim())
  );

  // Track names in current import to prevent duplicates within the same upload
  const importedNames = new Set<string>();

  for (const student of students) {
    try {
      const nameLower = student.name.toLowerCase().trim();

      // Check if student already exists in database
      if (existingNames.has(nameLower)) {
        skipped++;
        errors.push(
          `Skipped "${student.name}": Already exists in the system`
        );
        continue;
      }

      // Check if already imported in this batch
      if (importedNames.has(nameLower)) {
        skipped++;
        errors.push(
          `Skipped "${student.name}": Duplicate in upload file`
        );
        continue;
      }

      await addStudent(student.name, student.classType);
      importedNames.add(nameLower);
      existingNames.add(nameLower); // Add to existing set for next iterations
      success++;
    } catch (error) {
      failed++;
      errors.push(
        `Failed to import ${student.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return { success, failed, skipped, errors };
}

/**
 * Delete a student (marks as inactive)
 */
export async function deleteStudent(studentId: string): Promise<void> {
  const docRef = doc(db, "students", studentId);
  await updateDoc(docRef, {
    active: false,
  });
}

// ============ Attendance Operations ============

/**
 * Log a check-in
 */
export async function logCheckIn(
  studentId: string,
  studentName: string,
  classType: ClassType,
  weekNumber: number,
  isLate: boolean,
  lateMinutes: number | null
): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  const attendanceData: Omit<AttendanceRecord, "id"> = {
    studentId,
    studentName,
    checkInTime: Timestamp.fromDate(now),
    checkOutTime: null,
    classType,
    date: dateStr,
    weekNumber,
    isLate,
    lateMinutes,
    status: isLate ? "late" : "present",
  };

  const docRef = await addDoc(collection(db, "attendance"), attendanceData);
  return docRef.id;
}

/**
 * Log a check-out (update existing record)
 */
export async function logCheckOut(attendanceId: string): Promise<void> {
  const docRef = doc(db, "attendance", attendanceId);
  await updateDoc(docRef, {
    checkOutTime: Timestamp.now(),
  });
}

/**
 * Get today's attendance for a student
 */
export async function getTodayAttendance(
  studentId: string
): Promise<AttendanceRecord | null> {
  const today = new Date().toISOString().split("T")[0];

  const q = query(
    collection(db, "attendance"),
    where("studentId", "==", studentId),
    where("date", "==", today),
    limit(1)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as AttendanceRecord;
}

/**
 * Get attendance records for a date range
 */
export async function getAttendanceByDateRange(
  startDate: string,
  endDate: string
): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, "attendance"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date"),
    orderBy("checkInTime")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AttendanceRecord[];
}

/**
 * Get attendance records for a specific week
 */
export async function getAttendanceByWeek(
  weekNumber: number
): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, "attendance"),
    where("weekNumber", "==", weekNumber),
    orderBy("date"),
    orderBy("checkInTime")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AttendanceRecord[];
}

/**
 * Get recent attendance records (most recent first)
 */
export async function getRecentAttendance(
  limitCount: number = 50
): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, "attendance"),
    orderBy("checkInTime", "desc"),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AttendanceRecord[];
}

/**
 * Get all attendance records
 */
export async function getAllAttendance(): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, "attendance"),
    orderBy("checkInTime", "desc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AttendanceRecord[];
}

// ============ Weekly Sheet Operations ============

/**
 * Save weekly sheet metadata
 */
export async function saveWeeklySheet(
  weekNumber: number,
  startDate: string,
  endDate: string,
  sheetUrl: string,
  generationType: "auto" | "manual" = "auto"
): Promise<string> {
  const sheetData: Omit<WeeklySheet, "id"> = {
    weekNumber,
    startDate,
    endDate,
    sheetUrl,
    createdAt: Timestamp.now(),
    generationType,
  };

  const docRef = await addDoc(collection(db, "weeklySheets"), sheetData);
  return docRef.id;
}

/**
 * Get all weekly sheets
 */
export async function getAllWeeklySheets(): Promise<WeeklySheet[]> {
  const q = query(collection(db, "weeklySheets"), orderBy("weekNumber", "desc"));

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as WeeklySheet[];
}

/**
 * Get weekly sheet by week number
 */
export async function getWeeklySheetByWeekNumber(
  weekNumber: number
): Promise<WeeklySheet | null> {
  const q = query(
    collection(db, "weeklySheets"),
    where("weekNumber", "==", weekNumber),
    limit(1)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as WeeklySheet;
}
