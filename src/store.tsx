import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AppData, Course, Settings, Task } from './types';

const STORAGE_KEY = 'simestr:data:v1';

export const DEFAULT_REMINDERS = [15];

// Hatırlatma listesini tekrarsız, pozitif tam sayılar olarak büyükten küçüğe sıralar
export const normalizeReminders = (list: number[]) =>
  [...new Set(list.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => b - a);

type LegacyCourse = Omit<Course, 'reminders'> & { reminders?: number[]; reminder?: number | null; status?: unknown };

// Eski tekli "reminder" alanını listeye çevirir: sayı → [n], null → [], hiç yoksa varsayılan
function migrateReminders({ reminders, reminder }: LegacyCourse) {
  if (Array.isArray(reminders)) return normalizeReminders(reminders);
  if (reminder === undefined) return [...DEFAULT_REMINDERS];
  return reminder === null ? [] : normalizeReminders([reminder]);
}

const emptyData: AppData = { version: 1, courses: [], tasks: [], settings: { notifications: true } };

// Eski kayıtlarda bulunmayan alanları varsayılanlarla doldurur
function migrate(raw: Partial<AppData>): AppData {
  return {
    ...emptyData,
    ...raw,
    settings: { ...emptyData.settings, ...raw.settings },
    // Kaldırılan "durum" alanı eski kayıtlardan atılır; bütün dersler programda görünür
    courses: ((raw.courses ?? []) as LegacyCourse[]).map((legacy) => {
      const { status: _status, reminder: _reminder, ...c } = legacy;
      return { ...c, reminders: migrateReminders(legacy) };
    }),
  };
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

interface Store {
  data: AppData;
  loaded: boolean;
  addCourse: (course: Omit<Course, 'id' | 'createdAt'>) => Course;
  updateCourse: (id: string, patch: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setData(migrate(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  const addCourse = useCallback((course: Omit<Course, 'id' | 'createdAt'>) => {
    const created: Course = { ...course, id: uid(), createdAt: Date.now() };
    setData((d) => ({ ...d, courses: [...d.courses, created] }));
    return created;
  }, []);

  const updateCourse = useCallback((id: string, patch: Partial<Course>) => {
    setData((d) => ({ ...d, courses: d.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, []);

  const deleteCourse = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      courses: d.courses.filter((c) => c.id !== id),
      tasks: d.tasks.map((t) => (t.courseId === id ? { ...t, courseId: null } : t)),
    }));
  }, []);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>) => {
    const created: Task = { ...task, id: uid(), createdAt: Date.now() };
    setData((d) => ({ ...d, tasks: [...d.tasks, created] }));
    return created;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  return (
    <StoreContext.Provider
      value={{ data, loaded, addCourse, updateCourse, deleteCourse, addTask, updateTask, deleteTask, updateSettings }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore, StoreProvider içinde kullanılmalı');
  return ctx;
}
