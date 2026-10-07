import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../src/store';
import type { AppData, Course, Session, Task } from '../src/types';

export const STORAGE_KEY = 'simestr:data:v1';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export function makeSession(overrides: Partial<Session> = {}): Session {
  return { id: nextId('s'), day: 0, start: '09:00', end: '11:50', room: '', ...overrides };
}

export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: nextId('c'),
    code: 'BIL501',
    name: 'İleri Algoritma Analizi',
    instructor: '',
    credits: 7.5,
    semester: '2026-2027 Güz',
    color: '#4F46E5',
    letterGrade: null,
    sessions: [],
    assessments: [],
    notes: '',
    reminders: [15],
    createdAt: 0,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId('t'),
    courseId: null,
    title: 'Ödev',
    type: 'odev',
    due: '2026-10-10',
    done: false,
    notes: '',
    createdAt: 0,
    ...overrides,
  };
}

export function makeData(overrides: Partial<AppData> = {}): AppData {
  return { version: 1, courses: [], tasks: [], settings: { notifications: true }, ...overrides };
}

export async function seedStorage(data: unknown) {
  await AsyncStorage.setItem(STORAGE_KEY, typeof data === 'string' ? data : JSON.stringify(data));
}

export async function readStorage(): Promise<AppData | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <StoreProvider>{children}</StoreProvider>
    </SafeAreaProvider>
  );
}

/** Depoyu tohumlar, bileşeni Provider'larla render eder ve verinin yüklenmesini bekler. */
export async function renderWithStore(ui: ReactElement, data?: AppData) {
  if (data) await seedStorage(data);
  const result = await render(<Providers>{ui}</Providers>);
  // AsyncStorage okuma zincirinin (getItem → then → finally) tamamlanmasını bekle
  await act(async () => {});
  return result;
}
