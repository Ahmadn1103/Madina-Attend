"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseExcelFile, validateStudents, ParsedStudent } from "@/lib/excelParser";
import { bulkImportStudents } from "@/lib/firestore";

export default function RosterUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedStudent[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    skipped?: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData(null);
      setParseErrors([]);
      setImportResult(null);
    }
  };

  const handleParse = async () => {
    if (!file) return;

    setParsing(true);
    setParseErrors([]);
    setParsedData(null);

    try {
      const result = await parseExcelFile(file);

      if (result.errors.length > 0) {
        setParseErrors(result.errors);
      }

      if (result.students.length > 0) {
        const validation = validateStudents(result.students);
        if (!validation.valid) {
          setParseErrors([...parseErrors, ...validation.errors]);
        }
        setParsedData(result.students);
      } else {
        setParseErrors([...parseErrors, "No valid students found in the file"]);
      }
    } catch (error) {
      setParseErrors([
        error instanceof Error ? error.message : "Failed to parse Excel file",
      ]);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      const result = await bulkImportStudents(parsedData);
      setImportResult(result);

      if (result.success > 0) {
        // Clear the form after successful import
        setFile(null);
        setParsedData(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      setImportResult({
        success: 0,
        failed: parsedData.length,
        skipped: 0,
        errors: [
          error instanceof Error
            ? error.message
            : "Failed to import students",
        ],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setParseErrors([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Student Roster</CardTitle>
        <CardDescription>
          Upload an Excel file (.xlsx) with student names and class types
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
          />
          <p className="mt-2 text-xs text-gray-500">
            Expected columns: "Name" and "Class Type" (Weekend/Weekday/Both)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleParse}
            disabled={!file || parsing || importing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {parsing ? "Parsing..." : "Parse File"}
          </Button>
          {parsedData && (
            <Button
              onClick={handleImport}
              disabled={importing || parseErrors.length > 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {importing ? "Importing..." : `Import ${parsedData.length} Students`}
            </Button>
          )}
          {(file || parsedData || parseErrors.length > 0) && (
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={parsing || importing}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Parse Errors */}
        {parseErrors.length > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <h4 className="font-semibold text-red-800 mb-2">Parse Errors:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
              {parseErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Parsed Data Preview */}
        {parsedData && parsedData.length > 0 && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <h4 className="font-semibold text-emerald-800 mb-2">
              Found {parsedData.length} student{parsedData.length !== 1 ? "s" : ""}:
            </h4>
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-emerald-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Class Type</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((student, index) => (
                    <tr key={index} className="border-t border-emerald-200">
                      <td className="px-4 py-2">{student.name}</td>
                      <td className="px-4 py-2 capitalize">{student.classType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div
            className={`rounded-lg border p-4 ${
              importResult.success > 0
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <h4
              className={`font-semibold mb-2 ${
                importResult.success > 0 ? "text-green-800" : "text-red-800"
              }`}
            >
              Import Complete
            </h4>
            <div className="text-sm space-y-1">
              <p className="text-green-700">
                ✅ Successfully imported: {importResult.success}
              </p>
              {importResult.skipped && importResult.skipped > 0 && (
                <p className="text-yellow-700">⚠️ Skipped (duplicates): {importResult.skipped}</p>
              )}
              {importResult.failed > 0 && (
                <p className="text-red-700">❌ Failed: {importResult.failed}</p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-gray-700 mb-1">Details:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 max-h-40 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="text-xs">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
