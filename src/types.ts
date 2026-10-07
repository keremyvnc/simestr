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
  letterGrade: string | null;
  sessions: Session[];
  assessments: Assessment[];
  notes: string;
  reminders: number[]; // dersten kaç dakika önce bildirim (büyükten küçüğe, tekrarsız); boş = kapalı
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

export interface Settings {
  notifications: boolean; // tüm ders hatırlatmaları için ana anahtar
}

export interface AppData {
  version: 1;
  courses: Course[];
  tasks: Task[];
  settings: Settings;
}

export type Route = 'home' | 'courses';
