export type CourseStatus = 'active' | 'completed' | 'dropped';

export interface Session {
  id: string;
  day: number; // 0 = Pazartesi ... 6 = Pazar
  start: string; // "09:00"
  end: string; // "11:50"
  room: string;
}

export interface Assessment {
  id: string;
  name: string;
  weight: number; // yüzde
  score: number | null; // 0-100, girilmediyse null
}

export interface Course {
  id: string;
  code: string;
  name: string;
  instructor: string;
  credits: number; // AKTS
  semester: string; // "2026-2027 Güz"
  color: string;
  status: CourseStatus;
  letterGrade: string | null;
  sessions: Session[];
  assessments: Assessment[];
  notes: string;
  createdAt: number;
}

export type TaskType = 'odev' | 'sinav' | 'sunum' | 'proje' | 'okuma' | 'diger';

export interface Task {
  id: string;
  courseId: string | null;
  title: string;
  type: TaskType;
  due: string; // YYYY-MM-DD
  done: boolean;
  notes: string;
  createdAt: number;
}

export interface AppData {
  version: 1;
  courses: Course[];
  tasks: Task[];
}

export type Route = 'home' | 'courses';
