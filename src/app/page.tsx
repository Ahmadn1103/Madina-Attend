"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  name: string;
  classType: string;
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search students from database
  const searchStudents = async (query: string) => {
    if (query.trim().length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/search-students?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.status === "success" && data.students) {
        setSuggestions(data.students);
        setShowDropdown(data.students.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error("Error searching students:", error);
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  };

  // Handle name input change - instant search
  const handleNameChange = (value: string) => {
    setName(value);
    
    // Instant search - no delay
    if (value.trim().length >= 1) {
      searchStudents(value);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  // Handle selecting a student from dropdown
  const handleSelectStudent = (studentName: string) => {
    setName(studentName);
    setShowDropdown(false);
    setSuggestions([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (action: "checkin" | "checkout") => {
    if (!name.trim()) {
      setMessage({ type: "error", text: "Please enter your name" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          action,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        const actionText = action === "checkin" ? "checked in" : "checked out";
        setMessage({
          type: "success",
          text: data.message || `Successfully ${action === "checkin" ? "checked in" : "checked out"}!`,  // ✅ Use API message
        });
        setName("");
      } else {
        setMessage({ 
          type: "error", 
          text: data.message || "Failed to log attendance" 
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Failed to log attendance",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-yellow-50 p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 h-full w-full rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-gradient-to-tl from-yellow-200/30 to-transparent blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Admin Button - Top Right */}
      <Button
        onClick={() => router.push("/admin")}
        variant="outline"
        className="absolute top-6 right-6 z-20 border-2 border-emerald-600 bg-white/80 backdrop-blur-sm text-emerald-700 font-semibold shadow-lg transition-all hover:bg-emerald-50 hover:shadow-xl"
      >
        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Admin
      </Button>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center animate-fade-in">
          <div className="rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-emerald-100">
            <Image
              src="/madina-logo.png"
              alt="Madina Logo"
              width={200}
              height={80}
              className="h-auto w-48"
              priority
            />
          </div>
        </div>

        {/* Card */}
        <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-2xl ring-1 ring-emerald-100/50 animate-slide-up">
          <CardHeader className="space-y-3 pb-6 text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
              Attendance System
            </CardTitle>
            <CardDescription className="text-base text-gray-600">
              Welcome! Enter your name to check in or out.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Name Input with Autocomplete */}
            <div className="space-y-3 relative" ref={dropdownRef}>
              <Label htmlFor="name" className="text-sm font-semibold text-gray-700">
                Student Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  placeholder="Start typing your name..."
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  className="h-12 border-2 border-emerald-200 bg-white/50 text-base transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading && !showDropdown) {
                      handleSubmit("checkin");
                    }
                    if (e.key === "Escape") {
                      setShowDropdown(false);
                    }
                  }}
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-5 w-5 animate-spin text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>

              {/* Dropdown Suggestions */}
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-emerald-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-dropdown-fast">
                  {suggestions.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleSelectStudent(student.name)}
                      className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-emerald-100 last:border-b-0 focus:bg-emerald-50 focus:outline-none"
                    >
                      <div className="font-semibold text-gray-800">{student.name}</div>
                      <div className="text-xs text-gray-500 capitalize mt-1">
                        {student.classType === "both" ? "Weekend & Weekday" : student.classType} Class
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Success/Error Message */}
            {message && (
              <div
                className={`rounded-xl p-4 text-sm font-medium shadow-lg animate-fade-in ${
                  message.type === "success"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                    : "bg-gradient-to-r from-red-500 to-red-600 text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  {message.type === "success" ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span>{message.text}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Button
                onClick={() => handleSubmit("checkin")}
                disabled={loading}
                className="h-14 bg-gradient-to-r from-emerald-600 to-emerald-700 text-base font-semibold shadow-lg transition-all hover:from-emerald-700 hover:to-emerald-800 hover:shadow-xl disabled:opacity-50"
              >
                {loading ? (
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Check In</span>
                  </div>
                )}
              </Button>
              
              <Button
                onClick={() => handleSubmit("checkout")}
                disabled={loading}
                variant="outline"
                className="h-14 border-2 border-emerald-600 bg-white text-base font-semibold text-emerald-700 shadow-lg transition-all hover:bg-emerald-50 hover:shadow-xl disabled:opacity-50"
              >
                {loading ? (
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Check Out</span>
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600 animate-fade-in">
          <p>
            Powered by{" "}
            <a
              href="https://www.salam-consulting.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-600 hover:text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-500 transition-colors"
            >
              Salam Consulting
            </a>
          </p>
        </div>
        <div className="mt-6 text-center text-sm text-gray-600 animate-fade-in">
          <p>
            Developed by{" "}
            <a
              href="https://www.linkedin.com/in/ahmad-noori1103/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-600 hover:text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-500 transition-colors"
            >
              Ahmad Noori
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
