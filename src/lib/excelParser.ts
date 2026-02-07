/**
 * Excel Parser
 * Parse student roster from Excel files
 */
import * as XLSX from "xlsx";
import { ClassType } from "./firestore";

export interface ParsedStudent {
  name: string;
  classType: ClassType;
}

export interface ParseResult {
  students: ParsedStudent[];
  errors: string[];
  totalRows: number;
}

/**
 * Parse Excel file and extract student data
 * Expected columns: Name, Class Type (or ClassType, or Type)
 * Class Type values: "Weekend", "Weekday", or "Both" (case-insensitive)
 */
export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file"));
          return;
        }

        const workbook = XLSX.read(data, { type: "binary" });

        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error("No sheets found in the workbook"));
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        });

        if (jsonData.length === 0) {
          reject(new Error("Sheet is empty"));
          return;
        }

        const result = parseStudentData(jsonData);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Parse student data from sheet rows
 */
function parseStudentData(rows: any[][]): ParseResult {
  const students: ParsedStudent[] = [];
  const errors: string[] = [];

  if (rows.length < 2) {
    errors.push("File must contain at least a header row and one data row");
    return { students, errors, totalRows: rows.length };
  }

  // Find header row and column indices
  const headerRow = rows[0].map((h: any) =>
    String(h).toLowerCase().trim()
  );

  const nameColIndex = findColumnIndex(headerRow, [
    "name",
    "student name",
    "studentname",
    "student",
  ]);
  const classTypeColIndex = findColumnIndex(headerRow, [
    "class type",
    "classtype",
    "type",
    "class",
  ]);

  if (nameColIndex === -1) {
    errors.push(
      'Could not find "Name" column. Please ensure the Excel file has a "Name" or "Student Name" column.'
    );
  }

  if (classTypeColIndex === -1) {
    errors.push(
      'Could not find "Class Type" column. Please ensure the Excel file has a "Class Type" or "Type" column.'
    );
  }

  if (nameColIndex === -1 || classTypeColIndex === -1) {
    return { students, errors, totalRows: rows.length };
  }

  // Parse data rows (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    // Skip empty rows
    if (!row || row.length === 0 || row.every((cell) => !cell)) {
      continue;
    }

    const name = String(row[nameColIndex] || "").trim();
    const classTypeRaw = String(row[classTypeColIndex] || "").trim();

    // Validate name
    if (!name) {
      errors.push(`Row ${rowNumber}: Name is empty`);
      continue;
    }

    // Parse and validate class type
    const classType = parseClassType(classTypeRaw);
    if (!classType) {
      errors.push(
        `Row ${rowNumber}: Invalid class type "${classTypeRaw}". Must be "Weekend", "Weekday", or "Both".`
      );
      continue;
    }

    students.push({ name, classType });
  }

  return { students, errors, totalRows: rows.length };
}

/**
 * Find column index by matching multiple possible names
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.indexOf(name);
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

/**
 * Parse class type from string value
 */
function parseClassType(value: string): ClassType | null {
  const normalized = value.toLowerCase().trim();

  switch (normalized) {
    case "weekend":
    case "weekends":
    case "saturday":
    case "sunday":
      return "weekend";

    case "weekday":
    case "weekdays":
    case "monday":
    case "tuesday":
    case "wednesday":
    case "thursday":
    case "friday":
      return "weekday";

    case "both":
    case "all":
    case "weekend and weekday":
    case "weekday and weekend":
      return "both";

    default:
      return null;
  }
}

/**
 * Validate parsed students before import
 */
export function validateStudents(
  students: ParsedStudent[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (students.length === 0) {
    errors.push("No valid students found in the file");
    return { valid: false, errors };
  }

  // Check for duplicate names
  const nameSet = new Set<string>();
  const duplicates = new Set<string>();

  for (const student of students) {
    const nameLower = student.name.toLowerCase();
    if (nameSet.has(nameLower)) {
      duplicates.add(student.name);
    } else {
      nameSet.add(nameLower);
    }
  }

  if (duplicates.size > 0) {
    errors.push(
      `Duplicate names found: ${Array.from(duplicates).join(", ")}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
