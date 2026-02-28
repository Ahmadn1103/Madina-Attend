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
  const [manualStartDate, setManualStartDate] = useState("");
  const [manualEndDate, setManualEndDate] = useState("");
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  
  // Manual student adding
  const [newStudentFirstName, setNewStudentFirstName] = useState("");
  const [newStudentLastName, setNewStudentLastName] = useState("");
  const [newStudentClassType, setNewStudentClassType] = useState<"weekend" | "weekday" | "both">("weekend");
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentMessage, setAddStudentMessage] = useState<{type: "success" | "error", text: string} | null>(null);
  
  // Active students search
  const [activeStudentsSearch, setActiveStudentsSearch] = useState("");

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
      // Convert to Eastern Time (EST/EDT)
      return date.toLocaleString("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true, // Use 12-hour format with AM/PM for readability
      });
    } catch {
      return "Invalid Date";
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

  // Filter students by first name prefix or exact full name match
  const filteredStudents = students.filter((student) => {
    const searchLower = searchQuery.toLowerCase().trim();
    const fullNameLower = student.name.toLowerCase();
    
    // If search contains space, try exact or prefix match on full name
    if (searchLower.includes(' ')) {
      return fullNameLower === searchLower || fullNameLower.startsWith(searchLower);
    }
    
    // Otherwise match start of first name only
    const firstName = student.name.split(' ')[0].toLowerCase();
    return firstName.startsWith(searchLower);
  });

  // Filter active students by first name prefix or exact full name match
  const filteredActiveStudents = students.filter((student) => {
    const searchLower = activeStudentsSearch.toLowerCase().trim();
    const fullNameLower = student.name.toLowerCase();
    
    // If search contains space, try exact or prefix match on full name
    if (searchLower.includes(' ')) {
      return fullNameLower === searchLower || fullNameLower.startsWith(searchLower);
    }
    
    // Otherwise match start of first name only
    const firstName = student.name.split(' ')[0].toLowerCase();
    return firstName.startsWith(searchLower);
  });

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
    if (!manualStartDate || !manualEndDate) {
      alert("Please fill in both start and end dates");
      return;
    }

    setGeneratingWeekly(true);

    try {
      const response = await fetch("/api/admin/generate-manual-weekly-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: manualStartDate,
          endDate: manualEndDate,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        // Download the Excel file
        exportWeeklyReportToExcel(
          data.data.weekNumber,
          data.data.startDate,
          data.data.endDate,
          data.data.students,
          data.data.attendanceRecords
        );
        alert(`Weekly report generated successfully!\n\n${manualStartDate} to ${manualEndDate}\nRecords: ${data.data.attendanceRecords.length}`);
        // Clear form
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

  const handleAddStudent = async () => {
    if (!newStudentFirstName.trim() || !newStudentLastName.trim()) {
      setAddStudentMessage({ type: "error", text: "Please enter both first and last name" });
      return;
    }

    setAddingStudent(true);
    setAddStudentMessage(null);

    try {
      const response = await fetch("/api/admin/add-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: newStudentFirstName,
          lastName: newStudentLastName,
          classType: newStudentClassType,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setAddStudentMessage({ 
          type: "success", 
          text: `✅ ${data.studentName} added successfully to ${newStudentClassType} class!` 
        });
        // Clear form
        setNewStudentFirstName("");
        setNewStudentLastName("");
        setNewStudentClassType("weekend");
        // Refresh student list
        loadDashboardData();
      } else {
        setAddStudentMessage({ type: "error", text: data.message });
      }
    } catch (error) {
      console.error("Error adding student:", error);
      setAddStudentMessage({ type: "error", text: "Failed to add student. Please try again." });
    } finally {
      setAddingStudent(false);
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    console.log("Delete button clicked for:", student);
    console.log("Student ID:", student.id);
    
    if (!student.id) {
      alert("❌ Error: Student ID is missing. Please refresh the page and try again.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${student.name}"?\n\nThis will mark them as inactive but preserve their attendance history.`
    );

    if (!confirmDelete) {
      console.log("Delete cancelled by user");
      return;
    }

    console.log("Sending delete request for student ID:", student.id);

    try {
      const response = await fetch("/api/admin/delete-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id }),
      });

      console.log("Delete response status:", response.status);
      const data = await response.json();
      console.log("Delete response data:", data);

      if (data.status === "success") {
        alert(`✅ ${student.name} has been deleted successfully.`);
        // Refresh student list
        loadDashboardData();
      } else {
        alert(`❌ ${data.message || "Failed to delete student"}`);
      }
    } catch (error) {
      console.error("Error deleting student:", error);
      alert("❌ Failed to delete student. Please try again.");
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-slate-600 mt-1">Manage students and view reports</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={loading}
                className="border-slate-300 hover:bg-slate-50"
              >
                {loading ? "⏳ Loading..." : "🔄 Refresh"}
              </Button>
              <Button
                onClick={() => (window.location.href = "/")}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                ← Back to Check-In
              </Button>
              <Button
                onClick={() => setAuthenticated(false)}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                🚪 Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Students</p>
                <p className="text-4xl font-bold mt-2">{students.length}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <span className="text-3xl">👥</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Weekend Students</p>
                <p className="text-4xl font-bold mt-2">
                  {students.filter((s) => s.classType === "weekend" || s.classType === "both").length}
                </p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <span className="text-3xl">🌙</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Weekday Students</p>
                <p className="text-4xl font-bold mt-2">
                  {students.filter((s) => s.classType === "weekday" || s.classType === "both").length}
                </p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <span className="text-3xl">☀️</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Total Check-ins</p>
                <p className="text-4xl font-bold mt-2">{recentAttendance.length}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <span className="text-3xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg p-6 text-white transform transition hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm font-medium">Total Check-outs</p>
                <p className="text-4xl font-bold mt-2">{recentAttendance.filter((r) => r.checkOutTime).length}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <span className="text-3xl">🚪</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-2 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("students")}
            className={`flex-1 min-w-[120px] px-6 py-3 font-semibold rounded-lg transition-all ${
              activeTab === "students"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            👥 Students
          </button>
          <button
            onClick={() => setActiveTab("checkins")}
            className={`flex-1 min-w-[120px] px-6 py-3 font-semibold rounded-lg transition-all ${
              activeTab === "checkins"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            📋 Check-ins
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 min-w-[120px] px-6 py-3 font-semibold rounded-lg transition-all ${
              activeTab === "reports"
                ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            📊 Reports
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "students" && (
          <>
            {/* Manual Student Adding */}
            <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-lg">
              <CardHeader className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-t-lg">
                <CardTitle className="text-xl">➕ Add Individual Student</CardTitle>
                <CardDescription className="text-emerald-100">
                  Manually add a single student by name and class type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      type="text"
                      placeholder="Ahmad"
                      value={newStudentFirstName}
                      onChange={(e) => setNewStudentFirstName(e.target.value)}
                      className="mt-2"
                      disabled={addingStudent}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      type="text"
                      placeholder="Noori"
                      value={newStudentLastName}
                      onChange={(e) => setNewStudentLastName(e.target.value)}
                      className="mt-2"
                      disabled={addingStudent}
                    />
                  </div>
                  <div>
                    <Label htmlFor="class-type">Class Type</Label>
                    <select
                      id="class-type"
                      value={newStudentClassType}
                      onChange={(e) => setNewStudentClassType(e.target.value as "weekend" | "weekday" | "both")}
                      className="mt-2 w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      disabled={addingStudent}
                    >
                      <option value="weekend">Weekend</option>
                      <option value="weekday">Weekday</option>
                      <option value="both">Both (Weekend & Weekday)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleAddStudent}
                      disabled={addingStudent}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      {addingStudent ? "Adding..." : "➕ Add Student"}
                    </Button>
                  </div>
                </div>
                
                {addStudentMessage && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    addStudentMessage.type === "success" 
                      ? "bg-green-50 border border-green-200 text-green-800" 
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}>
                    {addStudentMessage.text}
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-3">
                  ⚠️ Note: Student names must be unique. Duplicates will be rejected even if in different classes.
                </p>
              </CardContent>
            </Card>

            {/* <RosterUpload /> */}
            <Card className="border-2 border-blue-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">👥 Active Students</CardTitle>
                    <CardDescription className="text-blue-100">
                      {filteredActiveStudents.length} of {students.length} student{students.length !== 1 ? "s" : ""} 
                      {activeStudentsSearch && " (filtered)"}
                    </CardDescription>
                  </div>
                  <div className="w-full md:w-80">
                    <Input
                      type="text"
                      placeholder="🔍 Search students..."
                      value={activeStudentsSearch}
                      onChange={(e) => setActiveStudentsSearch(e.target.value)}
                      className="w-full bg-white text-gray-900 placeholder:text-gray-500 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No students found. Upload a roster to get started.
                  </p>
                ) : filteredActiveStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No students found matching "{activeStudentsSearch}"
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredActiveStudents.map((student) => {
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <Button
                                  onClick={() => handleDeleteStudent(student)}
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                >
                                  🗑️ Delete
                                </Button>
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
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
              <CardTitle className="text-xl">📋 Recent Check-ins</CardTitle>
              <CardDescription className="text-blue-100">
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
                          Check-out Time
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
                            {record.checkOutTime ? (
                              formatTime(record.checkOutTime)
                            ) : (
                              <span className="text-yellow-600 font-medium">Not checked out</span>
                            )}
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
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-lg">
                <CardTitle className="text-xl">📥 Generate Weekly Report</CardTitle>
                <CardDescription className="text-purple-100">
                  Create an Excel report for all students for any date range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  disabled={generatingWeekly || !manualStartDate || !manualEndDate}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                >
                  {generatingWeekly ? "Generating..." : "📥 Download Excel Report"}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  This will download an Excel file with all students' attendance for the selected date range.
                </p>
              </CardContent>
            </Card>

            {/* Generate Student Report */}
            <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-t-lg">
                <CardTitle className="text-xl">📊 Generate Student Report</CardTitle>
                <CardDescription className="text-indigo-100">
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
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl mb-6 border border-emerald-200">
                        <div className="flex items-center gap-3 mb-6">
                          <span className="text-4xl">📊</span>
                          <h3 className="text-2xl font-bold text-gray-800">
                            {studentReportData.studentName}
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Total Check-ins</p>
                            <p className="text-3xl font-bold text-emerald-600 text-center">
                              {studentReportData.summary.totalCheckins}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Total Check-outs</p>
                            <p className="text-3xl font-bold text-teal-600 text-center">
                              {studentReportData.summary.totalCheckouts}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">On Time</p>
                            <p className="text-3xl font-bold text-green-600 text-center">
                              {studentReportData.summary.onTimeCheckins}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Late</p>
                            <p className="text-3xl font-bold text-red-600 text-center">
                              {studentReportData.summary.lateCheckins}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Total Late Time</p>
                            <p className="text-xl font-bold text-orange-600 text-center">
                              {formatMinutesToReadable(studentReportData.summary.totalLateMinutes)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Avg Late (mins)</p>
                            <p className="text-3xl font-bold text-gray-800 text-center">
                              {studentReportData.summary.averageLateMinutes}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Weekend Classes</p>
                            <p className="text-3xl font-bold text-gray-800 text-center">
                              {studentReportData.summary.weekendCheckins}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Weekday Classes</p>
                            <p className="text-3xl font-bold text-gray-800 text-center">
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
                                Check-out Time
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
                                  {record.checkOutTime ? (
                                    record.checkOutTime
                                  ) : (
                                    <span className="text-yellow-600 font-medium text-xs">Not checked out</span>
                                  )}
                                </td>
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
            {/*}
            <Card className="border-2 border-teal-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-t-lg">
                <CardTitle className="text-xl">📚 All Weekly Reports</CardTitle>
                <CardDescription className="text-teal-100">
                  Auto-generated (Sunday) and manually created reports - {weeklySheets.length} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {weeklySheets.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white-100 mb-4">
                      No weekly reports generated yet.
                    </p>
                    <p className="text-sm text-black-500">
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
            */}
          </>
        )}
      </div>
    </div>
  );
}
