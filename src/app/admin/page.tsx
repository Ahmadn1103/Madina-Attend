"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RosterUpload from "@/components/RosterUpload";
import { getActiveStudents, getAllWeeklySheets, getRecentAttendance } from "@/lib/firestore";
import type { Student, WeeklySheet, AttendanceRecord } from "@/lib/firestore";
import { exportStudentReportToExcel, exportWeeklyReportToExcel } from "@/lib/excelExport";
import { formatMinutesToReadable } from "@/lib/timeFormat";
import Image from "next/image";

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [weeklySheets, setWeeklySheets] = useState<WeeklySheet[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"students" | "checkins" | "reports">("students");
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [studentReportData, setStudentReportData] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualWeekNumber, setManualWeekNumber] = useState("");
  const [manualStartDate, setManualStartDate] = useState("");
  const [manualEndDate, setManualEndDate] = useState("");
  const [generatingWeekly, setGeneratingWeekly] = useState(false);

  // Authenticate via backend API (secure)
  const handleLogin = async () => {
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setAuthenticated(true);
        setError("");
        // Store token in sessionStorage for this session
        sessionStorage.setItem("adminToken", data.token);
        loadDashboardData();
      } else {
        setError(data.message || "Incorrect password");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Failed to authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [studentsData, sheetsData, attendanceData] = await Promise.all([
        getActiveStudents(),
        getAllWeeklySheets(),
        getRecentAttendance(100),
      ]);
      setStudents(studentsData);
      setWeeklySheets(sheetsData);
      setRecentAttendance(attendanceData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  const getStudentStats = (studentId: string) => {
    const attendance = recentAttendance.filter((a) => a.studentId === studentId);
    const lastCheckIn = attendance.length > 0 ? attendance[0] : null; // Most recent is first
    return {
      total: attendance.length,
      late: attendance.filter((a) => a.isLate).length,
      onTime: attendance.filter((a) => !a.isLate).length,
      lastCheckIn: lastCheckIn ? formatTime(lastCheckIn.checkInTime) : "Never",
    };
  };

  const handleGenerateStudentReport = async (student: Student) => {
    setGeneratingReport(true);
    setStudentReportData(null);
    setSelectedStudentForReport(student);

    try {
      const response = await fetch("/api/admin/generate-student-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setStudentReportData(data.data);
      } else {
        alert(data.message || "No data found for this student");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report");
    } finally {
      setGeneratingReport(false);
    }
  };

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownloadStudentReport = () => {
    if (studentReportData) {
      exportStudentReportToExcel(studentReportData);
    }
  };

  const handleDownloadWeeklyReport = async (weekNumber: number) => {
    try {
      const response = await fetch("/api/admin/generate-weekly-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNumber }),
      });

      const data = await response.json();

      if (data.status === "success") {
        exportWeeklyReportToExcel(
          data.data.weekNumber,
          data.data.startDate,
          data.data.endDate,
          data.data.students,
          data.data.attendanceRecords
        );
      } else {
        alert(data.message || "No data found for this week");
      }
    } catch (error) {
      console.error("Error downloading weekly report:", error);
      alert("Failed to download report");
    }
  };

  const handleGenerateManualWeekly = async () => {
    if (!manualWeekNumber || !manualStartDate || !manualEndDate) {
      alert("Please fill in all fields");
      return;
    }

    setGeneratingWeekly(true);

    try {
      const response = await fetch("/api/admin/generate-manual-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: parseInt(manualWeekNumber),
          startDate: manualStartDate,
          endDate: manualEndDate,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        alert(`Weekly report generated successfully!\n\nWeek: ${data.weekNumber}\nRecords: ${data.recordCount}`);
        // Reload dashboard to show new report
        loadDashboardData();
        // Clear form
        setManualWeekNumber("");
        setManualStartDate("");
        setManualEndDate("");
      } else {
        alert(data.message || "Failed to generate report");
      }
    } catch (error) {
      console.error("Error generating manual weekly report:", error);
      alert("Failed to generate report");
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-yellow-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <Image
                src="/madina-logo.png"
                alt="Madina Logo"
                width={150}
                height={60}
                className="h-auto"
              />
            </div>
            <CardTitle>Admin Dashboard</CardTitle>
            <CardDescription>Enter password to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleLogin();
                  }
                }}
                placeholder="Enter admin password"
                className="mt-2"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? "Authenticating..." : "Login"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-yellow-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Manage students and view reports</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
            >
              Back to Check-In
            </Button>
            <Button
              onClick={() => setAuthenticated(false)}
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Students</CardDescription>
              <CardTitle className="text-3xl">{students.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Weekend Students</CardDescription>
              <CardTitle className="text-3xl">
                {students.filter((s) => s.classType === "weekend" || s.classType === "both").length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Weekday Students</CardDescription>
              <CardTitle className="text-3xl">
                {students.filter((s) => s.classType === "weekday" || s.classType === "both").length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Check-ins</CardDescription>
              <CardTitle className="text-3xl">{recentAttendance.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b">
          <button
            onClick={() => setActiveTab("students")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "students"
                ? "border-b-2 border-emerald-600 text-emerald-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab("checkins")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "checkins"
                ? "border-b-2 border-emerald-600 text-emerald-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Recent Check-ins
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "reports"
                ? "border-b-2 border-emerald-600 text-emerald-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Weekly Reports
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "students" && (
          <>
            <RosterUpload />
            <Card>
              <CardHeader>
                <CardTitle>Active Students</CardTitle>
                <CardDescription>
                  {students.length} student{students.length !== 1 ? "s" : ""} enrolled
                </CardDescription>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No students found. Upload a roster to get started.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Class Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Check-in
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Check-ins
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Late
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            On Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {students.map((student) => {
                          const stats = getStudentStats(student.id || "");
                          return (
                            <tr key={student.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {student.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  student.classType === "weekend"
                                    ? "bg-blue-100 text-blue-800"
                                    : student.classType === "weekday"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}>
                                  {student.classType}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {stats.lastCheckIn}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                {stats.total}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                {stats.late}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                                {stats.onTime}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "checkins" && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Check-ins</CardTitle>
              <CardDescription>
                Last {recentAttendance.length} check-in records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentAttendance.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No check-ins recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Check-in Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Class Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Late Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentAttendance.map((record) => (
                        <tr key={record.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.studentName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatTime(record.checkInTime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              record.classType === "weekend"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}>
                              {record.classType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              record.isLate
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}>
                              {record.isLate ? "Late" : "On Time"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.lateMinutes ? formatMinutesToReadable(record.lateMinutes) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "reports" && (
          <>
            {/* Generate Manual Weekly Report */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Weekly Report (Manual)</CardTitle>
                <CardDescription>
                  Create a weekly report for all students for any week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="week-number">Week Number</Label>
                    <Input
                      id="week-number"
                      type="number"
                      min="1"
                      placeholder="e.g., 1"
                      value={manualWeekNumber}
                      onChange={(e) => setManualWeekNumber(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={manualStartDate}
                      onChange={(e) => setManualStartDate(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={manualEndDate}
                      onChange={(e) => setManualEndDate(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleGenerateManualWeekly}
                  disabled={generatingWeekly}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                >
                  {generatingWeekly ? "Generating..." : "📊 Generate Weekly Report"}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  This will create a Google Sheet report with all students' attendance for the specified week.
                </p>
              </CardContent>
            </Card>

            {/* Generate Student Report */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Student Report (Individual)</CardTitle>
                <CardDescription>
                  Create a custom report for any student showing all their attendance data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="student-search">Search Student</Label>
                    <Input
                      id="student-search"
                      type="text"
                      placeholder="Type student name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {searchQuery && filteredStudents.length > 0 && (
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      {filteredStudents.slice(0, 10).map((student) => (
                        <div
                          key={student.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between border-b last:border-b-0"
                          onClick={() => handleGenerateStudentReport(student)}
                        >
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-gray-500 capitalize">
                              {student.classType} class
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            Generate Report
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery && filteredStudents.length === 0 && (
                    <p className="text-gray-500 text-center py-4">
                      No students found matching "{searchQuery}"
                    </p>
                  )}

                  {generatingReport && (
                    <div className="text-center py-4">
                      <p className="text-gray-600">Generating report...</p>
                    </div>
                  )}

                  {studentReportData && selectedStudentForReport && (
                    <div className="border-t pt-4 mt-4">
                      <div className="bg-emerald-50 p-4 rounded-lg mb-4">
                        <h3 className="text-xl font-bold mb-2">
                          {studentReportData.studentName}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-gray-600">Total Check-ins</p>
                            <p className="text-2xl font-bold text-emerald-600">
                              {studentReportData.summary.totalCheckins}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">On Time</p>
                            <p className="text-2xl font-bold text-green-600">
                              {studentReportData.summary.onTimeCheckins}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Late</p>
                            <p className="text-2xl font-bold text-red-600">
                              {studentReportData.summary.lateCheckins}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Total Late Time</p>
                            <p className="text-lg font-bold text-orange-600">
                              {formatMinutesToReadable(studentReportData.summary.totalLateMinutes)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-gray-600">Avg Late (mins)</p>
                            <p className="text-xl font-semibold">
                              {studentReportData.summary.averageLateMinutes}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Weekend Classes</p>
                            <p className="text-xl font-semibold">
                              {studentReportData.summary.weekendCheckins}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Weekday Classes</p>
                            <p className="text-xl font-semibold">
                              {studentReportData.summary.weekdayCheckins}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <h4 className="font-semibold mb-2">Attendance History</h4>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Date
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Check-in Time
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Class Type
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Late Time
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Week #
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {studentReportData.records.map((record: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm">{record.date}</td>
                                <td className="px-4 py-2 text-sm">{record.checkInTime}</td>
                                <td className="px-4 py-2 text-sm">
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      record.classType === "weekend"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {record.classType}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      record.status === "Late"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm">{record.lateMinutes ? formatMinutesToReadable(record.lateMinutes) : "-"}</td>
                                <td className="px-4 py-2 text-sm">{record.weekNumber}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={handleDownloadStudentReport}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          📥 Download Excel Report
                        </Button>
                        <Button
                          onClick={() => {
                            setStudentReportData(null);
                            setSelectedStudentForReport(null);
                            setSearchQuery("");
                          }}
                          variant="outline"
                        >
                          Close Report
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* All Weekly Reports */}
            <Card>
              <CardHeader>
                <CardTitle>All Weekly Reports</CardTitle>
                <CardDescription>
                  Auto-generated (Sunday) and manually created reports - {weeklySheets.length} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {weeklySheets.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      No weekly reports generated yet.
                    </p>
                    <p className="text-sm text-gray-400">
                      Reports are automatically generated every Sunday at midnight, or create one manually above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weeklySheets.map((sheet) => (
                      <div
                        key={sheet.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-lg">Week {sheet.weekNumber}</p>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                sheet.generationType === "auto"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {sheet.generationType === "auto" ? "Auto Generated" : "Manual"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {sheet.startDate} to {sheet.endDate}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Created: {formatTime(sheet.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleDownloadWeeklyReport(sheet.weekNumber)}
                            variant="outline"
                            size="sm"
                          >
                            📥 Download Excel
                          </Button>
                          <Button
                            onClick={() => window.open(sheet.sheetUrl, "_blank")}
                            className="bg-emerald-600 hover:bg-emerald-700"
                            size="sm"
                          >
                            View Google Sheet →
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
