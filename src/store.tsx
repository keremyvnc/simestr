import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AppData, Course, Task } from './types';

const STORAGE_KEY = 'simestr:data:v1';

const emptyData: AppData = { version: 1, courses: [], tasks: [] };

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
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setData({ ...emptyData, ...JSON.parse(raw) });
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

  return (
    <StoreContext.Provider
      value={{ data, loaded, addCourse, updateCourse, deleteCourse, addTask, updateTask, deleteTask }}
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
