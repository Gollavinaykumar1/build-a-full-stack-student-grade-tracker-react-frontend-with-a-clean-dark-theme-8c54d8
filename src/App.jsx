import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, SortAsc, SortDesc, User, Award, TrendingUp, TrendingDown, X, BookOpen, Calculator, Atom, Globe, History, Hash } from 'lucide-react';


import clsx from 'clsx';

// CRITICAL API RULE: In a real app, these functions would be imported from './api'.
// For this single-file requirement, they are defined directly here.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

let studentCounter = 1;
const initialStudents = [
  { id: studentCounter++, rollNo: 'S001', name: 'Alice Smith', math: 95, science: 88, english: 92, history: 80 },
  { id: studentCounter++, rollNo: 'S002', name: 'Bob Johnson', math: 70, science: 75, english: 68, history: 60 },
  { id: studentCounter++, rollNo: 'S003', name: 'Charlie Brown', math: 82, science: 90, english: 85, history: 77 },
  { id: studentCounter++, rollNo: 'S004', name: 'Diana Prince', math: 65, science: 58, english: 72, history: 50 },
  { id: studentCounter++, rollNo: 'S005', name: 'Eve Adams', math: 45, science: 30, english: 55, history: 40 },
  { id: studentCounter++, rollNo: 'S006', name: 'Frank White', math: 90, science: 92, english: 88, history: 95 },
  { id: studentCounter++, rollNo: 'S007', name: 'Grace Lee', math: 78, science: 81, english: 75, history: 83 },
  { id: studentCounter++, rollNo: 'S008', name: 'Harry King', math: 55, science: 60, english: 62, history: 58 },
  { id: studentCounter++, rollNo: 'S009', name: 'Ivy Green', math: 92, science: 95, english: 90, history: 88 },
  { id: studentCounter++, rollNo: 'S010', name: 'Jack Black', math: 68, science: 70, english: 65, history: 72 },
];

const mockStudents = [...initialStudents]; // Use a mutable copy for adding new students

const api = {
  getStudents: async () => {
    return new Promise(resolve => {
      setTimeout(() => {
        // CRITICAL DATA SAFETY: Ensure returned data is array or empty array
        const responseData = Array.isArray(mockStudents) ? mockStudents : (mockStudents?.items || []);
        resolve({ data: responseData });
      }, 700); // Simulate network delay
    });
  },
  createStudent: async (studentData) => {
    return new Promise(resolve => {
      setTimeout(() => {
        const newStudent = {
          id: studentCounter++,
          rollNo: `S${String(studentCounter - 1).padStart(3, '0')}`,
          ...studentData,
        };
        mockStudents.push(newStudent); // Add to our mock data
        resolve({ data: newStudent });
      }, 700); // Simulate network delay
    });
  },
};
// End of api.js placeholder functions.

// Utility functions
const calculateAverage = (student) => {
  const scores = [student.math, student.science, student.english, student.history];
  const total = scores.reduce((sum, score) => sum + score, 0);
  return (total / scores.length).toFixed(1);
};

const getGradeLetter = (average) => {
  if (average >= 90) return 'A+';
  if (average >= 80) return 'A';
  if (average >= 70) return 'B';
  if (average >= 60) return 'C';
  if (average >= 50) return 'D';
  return 'F';
};

const getGradeColorClass = (average) => {
  if (average >= 90) return 'bg-emerald-600'; // A+
  if (average >= 80) return 'bg-blue-600';    // A
  if (average >= 70) return 'bg-indigo-600';  // B
  if (average >= 60) return 'bg-yellow-600';  // C
  if (average >= 50) return 'bg-orange-600';  // D
  return 'bg-rose-600';                     // F
};

// Main App Component
function App() {
  const navigate = useNavigate(); // CRITICAL ROUTING RULE: Using useNavigate
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortBy, setSortBy] = useState(null); // 'name' or 'average'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getStudents();
      // CRITICAL DATA SAFETY: Parse API list responses safely
      const safeStudents = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      setStudents(safeStudents);
    } catch (error) {
      toast.error('Failed to fetch students. Please try again.');
      console.error('Fetch students error:', error);
      setStudents([]); // Ensure students is an array even on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleAddStudent = useCallback(async (data) => {
    try {
      const parsedScores = {
        math: parseFloat(data.math),
        science: parseFloat(data.science),
        english: parseFloat(data.english),
        history: parseFloat(data.history),
      };
      const newStudent = { ...data, ...parsedScores };

      toast.promise(api.createStudent(newStudent), {
        loading: 'Adding student...',
        success: 'Student added successfully!',
        error: 'Failed to add student. Please try again.',
      }).then((response) => {
        setStudents((prev) => [...prev, response.data]);
        setShowAddModal(false);
      });
    } catch (error) {
      console.error('Error adding student:', error);
    }
  }, []);

  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }, [sortBy, sortOrder]);

  const sortedStudents = React.useMemo(() => {
    if (!sortBy) return students;

    return [...students].sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === 'average') {
        valA = parseFloat(calculateAverage(a));
        valB = parseFloat(calculateAverage(b));
      } else {
        return 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, sortBy, sortOrder]);

  // Statistics calculations
  const totalStudents = students.length;
  const classAverage = totalStudents > 0
    ? (students.reduce((sum, s) => sum + parseFloat(calculateAverage(s)), 0) / totalStudents).toFixed(1)
    : '0.0';
  const passingCount = students.filter(s => parseFloat(calculateAverage(s)) >= 50).length;
  const failingCount = totalStudents - passingCount;

  // Sub-component: StatCard
  const StatCard = ({ icon: Icon, title, value, colorClass }) => (
    <div className={clsx(
      "relative p-6 rounded-2xl shadow-xl overflow-hidden group",
      "backdrop-filter backdrop-blur-lg bg-opacity-10 border border-opacity-20",
      "flex flex-col items-start transition-all duration-300 transform hover:scale-105 hover:shadow-2xl",
      "text-white",
      colorClass
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
      <div className="flex items-center space-x-4 mb-4">
        <div className="p-3 rounded-full bg-white/15 backdrop-blur-md">
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-gray-200">{title}</h3>
      </div>
      <p className="text-4xl font-extrabold">{value}</p>
    </div>
  );

  // Sub-component: AddStudentModal
  const AddStudentModal = ({ onClose, onAddStudent }) => {
    const { register, handleSubmit, formState: { errors }, reset } = useForm();

    const onSubmit = (data) => {
      onAddStudent(data);
      reset();
    };

    const inputClasses = "w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white " +
      "focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 " +
      "placeholder-gray-400 focus:bg-white/15";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
    const errorClasses = "text-rose-400 text-sm mt-1";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
        <div className="relative w-full max-w-lg p-8 rounded-3xl shadow-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80
                        backdrop-filter backdrop-blur-lg border border-purple-500/30 text-white
                        animate-fade-in-up transition-all duration-300">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <X className="h-5 w-5 text-gray-300" />
          </button>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-6 pb-2 border-b border-white/10">
            Add New Student
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-y-5">
            <div>
              <label htmlFor="name" className={labelClasses}>Student Name</label>
              <input
                id="name"
                type="text"
                {...register("name", { required: "Student Name is required" })}
                className={inputClasses}
                placeholder="e.g., Jane Doe"
              />
              {errors.name && <p className={errorClasses}>{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              {[
                { label: "Math Score", name: "math", icon: Calculator },
                { label: "Science Score", name: "science", icon: Atom },
                { label: "English Score", name: "english", icon: Globe },
                { label: "History Score", name: "history", icon: History },
              ].map((field) => (
                <div key={field.name}>
                  <label htmlFor={field.name} className={labelClasses}>
                    <field.icon className="inline-block h-4 w-4 mr-1 text-purple-300" />
                    {field.label}
                  </label>
                  <input
                    id={field.name}
                    type="number"
                    {...register(field.name, {
                      required: `${field.label} is required`,
                      min: { value: 0, message: "Score cannot be less than 0" },
                      max: { value: 100, message: "Score cannot be more than 100" },
                      valueAsNumber: true,
                    })}
                    className={inputClasses}
                    placeholder="0-100"
                  />
                  {errors[field.name] && <p className={errorClasses}>{errors[field.name].message}</p>}
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="mt-6 w-full py-3 px-6 rounded-xl font-bold text-lg
                         bg-gradient-to-r from-purple-600 to-pink-600 text-white
                         shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-pink-700
                         transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Add Student
            </button>
          </form>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white font-sans antialiased">
      <Toaster position="top-right" />

      {/* Header / Hero Section */}
      <header className="relative py-16 px-6 lg:px-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20 opacity-30 blur-3xl z-0"></div>
        <div className="absolute inset-0 bg-dots opacity-5 z-0"></div> {/* Subtle background pattern */}
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 drop-shadow-lg">
              GradeCentral.ai
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
              Effortlessly track and manage student grades with a stunning, intuitive interface.
              Gain insights at a glance and ensure academic success.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="group relative flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold
                       bg-gradient-to-r from-emerald-500 to-cyan-500 text-white
                       shadow-md shadow-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/40
                       transition-all duration-300 transform hover:scale-105 hover:-translate-y-1
                       overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Student
            </span>
            <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <StatCard icon={User} title="Total Students" value={totalStudents} colorClass="from-purple-500/10 to-transparent" />
          <StatCard icon={BookOpen} title="Class Average" value={`${classAverage}%`} colorClass="from-blue-500/10 to-transparent" />
          <StatCard icon={TrendingUp} title="Passing Students" value={passingCount} colorClass="from-emerald-500/10 to-transparent" />
          <StatCard icon={TrendingDown} title="Failing Students" value={failingCount} colorClass="from-rose-500/10 to-transparent" />
        </div>

        {/* Student Table */}
        <div className="relative overflow-x-auto rounded-3xl shadow-2xl border border-white/10
                        bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-filter backdrop-blur-lg">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-lg">Loading students...</div>
          ) : sortedStudents.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-lg">
              No students found. Add a new student to get started!
            </div>
          ) : (
            <table className="w-full text-left text-gray-300">
              <thead className="text-xs uppercase bg-white/5 border-b border-white/10 text-gray-200">
                <tr>
                  <th scope="col" className="p-4 rounded-tl-xl">
                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleSort('rollNo')}>
                      <Hash className="h-4 w-4" /> Roll No
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleSort('name')}>
                      Name
                      {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />)}
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">Math</th>
                  <th scope="col" className="px-4 py-3 text-center">Science</th>
                  <th scope="col" className="px-4 py-3 text-center">English</th>
                  <th scope="col" className="px-4 py-3 text-center">History</th>
                  <th scope="col" className="px-4 py-3">
                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleSort('average')}>
                      Avg %
                      {sortBy === 'average' && (sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />)}
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3 rounded-tr-xl text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student) => {
                  const average = calculateAverage(student);
                  const gradeLetter = getGradeLetter(average);
                  const gradeColorClass = getGradeColorClass(average);
                  return (
                    <tr
                      key={student.id}
                      className="group border-b border-white/5 last:border-b-0
                                 hover:bg-white/5 transition-colors duration-200"
                    >
                      <td className="p-4 font-medium text-gray-100">{student.rollNo}</td>
                      <td className="px-4 py-3 font-medium text-purple-300">{student.name}</td>
                      <td className="px-4 py-3 text-center text-blue-300">{student.math}</td>
                      <td className="px-4 py-3 text-center text-teal-300">{student.science}</td>
                      <td className="px-4 py-3 text-center text-yellow-300">{student.english}</td>
                      <td className="px-4 py-3 text-center text-orange-300">{student.history}</td>
                      <td className="px-4 py-3 font-semibold text-gray-100">{average}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx(
                          "px-3 py-1.5 rounded-full text-xs font-bold uppercase",
                          gradeColorClass,
                          "shadow-md",
                          "transition-all duration-200 group-hover:scale-105 group-hover:brightness-125"
                        )}>
                          {gradeLetter}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onAddStudent={handleAddStudent} />}
    </div>
  );
}

// Router wrapper for App
function Root() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        {/* Add more routes if needed, e.g., /settings, /student/:id */}
      </Routes>
    </Router>
  );
}

export default Root;