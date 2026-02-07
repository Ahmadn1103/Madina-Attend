"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { searchStudents } from "@/lib/firestore";
import type { Student } from "@/lib/firestore";

interface StudentAutocompleteProps {
  value: string;
  onChange: (value: string, studentId?: string) => void;
  onSelect?: (student: Student) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function StudentAutocomplete({
  value,
  onChange,
  onSelect,
  disabled = false,
  placeholder = "Enter your full name",
  className = "",
}: StudentAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Student[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Search students when input changes
  useEffect(() => {
    const searchStudentsDebounced = async () => {
      if (!value || value.length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoading(true);
      try {
        const results = await searchStudents(value);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Error searching students:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchStudentsDebounced, 300);
    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleSelectStudent = (student: Student) => {
    onChange(student.name, student.id);
    setShowSuggestions(false);
    setSuggestions([]);
    if (onSelect) {
      onSelect(student);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;

      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectStudent(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          handleSelectStudent(suggestions[0]);
        }
        break;

      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="animate-spin h-4 w-4 text-emerald-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-emerald-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((student, index) => (
            <button
              key={student.id}
              type="button"
              onClick={() => handleSelectStudent(student)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors ${
                index === selectedIndex ? "bg-emerald-50" : ""
              } ${index > 0 ? "border-t border-gray-100" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{student.name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    student.classType === "weekend"
                      ? "bg-blue-100 text-blue-700"
                      : student.classType === "weekday"
                      ? "bg-green-100 text-green-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {student.classType}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && !loading && value.length >= 1 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
          No students found. Try a different name or contact the administrator.
        </div>
      )}
    </div>
  );
}
