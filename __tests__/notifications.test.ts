import { renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import {
  ensurePermission,
  leadLabel,
  MAX_SCHEDULED,
  notificationsSupported,
  REMINDER_OPTIONS,
  reminderSummary,
  syncReminders,
  useReminderSync,
} from '../src/notifications';
import type { Course } from '../src/types';
import { makeCourse, makeSession } from './helpers';

const N = jest.mocked(Notifications);

const scheduled = () => N.scheduleNotificationAsync.mock.calls.map(([req]) => req);
const triggers = () => scheduled().map((r) => r.trigger);

describe('leadLabel', () => {
  it.each([
    [5, '5 dk'],
    [15, '15 dk'],
    [60, '1 sa'],
    [90, '90 dk'],
    [120, '2 sa'],
    [1440, '1 gün'],
    [1500, '25 sa'],
  ])('%p → %p', (input, expected) => {
    expect(leadLabel(input)).toBe(expected);
  });
});

describe('reminderSummary', () => {
  it.each([
    [[], 'Hatırlatma yok'],
    [[15], 'Hatırlatma: 15 dk önce'],
    [[10, 60], 'Hatırlatma: 1 sa, 10 dk önce'],
    [[120, 5, 120], 'Hatırlatma: 2 sa, 5 dk önce'],
  ])('%p → %p', (input, expected) => {
    expect(reminderSummary(input)).toBe(expected);
  });
});

describe('REMINDER_OPTIONS', () => {
  it('beklenen süreler artan sırada, Kapalı seçeneği yok', () => {
    expect(REMINDER_OPTIONS.map((o) => o.label)).toEqual(['5 dk', '10 dk', '15 dk', '30 dk', '1 sa', '2 sa', '1 gün']);
    const values = REMINDER_OPTIONS.map((o) => o.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('ensurePermission', () => {
  it('testte (iOS) bildirimler destekleniyor', () => {
    expect(notificationsSupported).toBe(true);
  });

  it('izin zaten verilmişse tekrar sormaz', async () => {
    await expect(ensurePermission()).resolves.toBe(true);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('tekrar sorulamıyorsa false döner', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    await expect(ensurePermission()).resolves.toBe(false);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('izin yoksa sorar ve sonucu döner', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    N.requestPermissionsAsync.mockResolvedValueOnce({ granted: true } as never);
    await expect(ensurePermission()).resolves.toBe(true);

    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    N.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    await expect(ensurePermission()).resolves.toBe(false);
  });
});

describe('syncReminders', () => {
  it('önce tüm planlı bildirimleri iptal eder; kapalıysa yenisini kurmaz', async () => {
    const course = makeCourse({ sessions: [makeSession()] });
    await syncReminders([course], false);
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('yalnızca hatırlatması açık ve oturumu olan dersleri planlar', async () => {
    const courses: Course[] = [
      makeCourse({ code: 'AKTIF', sessions: [makeSession()] }),
      makeCourse({ code: 'KAPALI', reminders: [], sessions: [makeSession()] }),
      makeCourse({ code: 'SAATSIZ', sessions: [] }),
    ];
    await syncReminders(courses, true);
    expect(scheduled()).toHaveLength(1);
    expect(scheduled()[0].content.title).toMatch(/^AKTIF /);
  });

  it('her oturum için ayrı haftalık bildirim kurar', async () => {
    const course = makeCourse({ sessions: [makeSession({ day: 0 }), makeSession({ day: 2 })] });
    await syncReminders([course], true);
    expect(scheduled()).toHaveLength(2);
    expect(triggers().every((t) => (t as { type: string }).type === 'weekly')).toBe(true);
  });

  it('hiç hedef yoksa izin istemez', async () => {
    await syncReminders([makeCourse()], true);
    expect(N.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('izin verilmezse planlama yapmaz', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    await syncReminders([makeCourse({ sessions: [makeSession()] })], true);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it.each([
    // [gün, başlangıç, hatırlatma dk, beklenen weekday, saat, dakika]
    ['Pzt 09:00, 15 dk', 0, '09:00', 15, 2, 8, 45],
    ['Cmt 13:30, 60 dk', 5, '13:30', 60, 7, 12, 30],
    ['Paz 10:00, 5 dk', 6, '10:00', 5, 1, 9, 55],
    ['Sal 00:10, 30 dk → Pzt 23:40', 1, '00:10', 30, 2, 23, 40],
    ['Pzt 00:05, 10 dk → Paz 23:55', 0, '00:05', 10, 1, 23, 55],
    ['Çar 00:30, 30 dk → tam gece yarısı', 2, '00:30', 30, 4, 0, 0],
    ['Per 14:00, 2 sa', 3, '14:00', 120, 5, 12, 0],
    ['Cum 01:00, 2 sa → Per 23:00', 4, '01:00', 120, 5, 23, 0],
    ['Sal 09:00, 1 gün → Pzt 09:00', 1, '09:00', 1440, 2, 9, 0],
    ['Pzt 09:00, 1 gün → Paz 09:00', 0, '09:00', 1440, 1, 9, 0],
    ['Paz 00:30, 1 gün → Cmt 00:30', 6, '00:30', 1440, 7, 0, 30],
  ])('%s', async (_name, day, start, reminder, weekday, hour, minute) => {
    const course = makeCourse({ reminders: [reminder], sessions: [makeSession({ day, start })] });
    await syncReminders([course], true);
    expect(triggers()[0]).toMatchObject({ weekday, hour, minute, channelId: 'class-reminders' });
  });

  it('başlık ve gövdeyi derslik bilgisiyle oluşturur', async () => {
    const course = makeCourse({
      code: 'BIL501',
      name: 'Algoritmalar',
      reminders: [60],
      sessions: [makeSession({ start: '09:00', room: 'B-204' }), makeSession({ start: '13:00', room: '' })],
    });
    await syncReminders([course], true);
    expect(scheduled()[0].content).toEqual({ title: 'BIL501 · 1 sa sonra', body: 'Algoritmalar — 09:00, B-204' });
    expect(scheduled()[1].content).toEqual({ title: 'BIL501 · 1 sa sonra', body: 'Algoritmalar — 13:00' });
  });
});

describe('syncReminders — çoklu hatırlatma', () => {
  it('her oturum × hatırlatma için ayrı bildirim ve doğru başlık kurar', async () => {
    const course = makeCourse({
      code: 'BIL501',
      reminders: [10, 120, 60, 10],
      sessions: [makeSession({ day: 0, start: '09:00' }), makeSession({ day: 2, start: '13:00' })],
    });
    await syncReminders([course], true);
    expect(scheduled()).toHaveLength(6);
    expect(scheduled().map((r) => r.content.title)).toEqual([
      'BIL501 · 10 dk sonra',
      'BIL501 · 1 sa sonra',
      'BIL501 · 2 sa sonra',
      'BIL501 · 10 dk sonra',
      'BIL501 · 1 sa sonra',
      'BIL501 · 2 sa sonra',
    ]);
    expect(triggers().slice(0, 3)).toEqual([
      expect.objectContaining({ weekday: 2, hour: 8, minute: 50 }),
      expect.objectContaining({ weekday: 2, hour: 8, minute: 0 }),
      expect.objectContaining({ weekday: 2, hour: 7, minute: 0 }),
    ]);
  });

  it('aynı oturumun hatırlatmaları farklı günlere düşebilir', async () => {
    const course = makeCourse({ reminders: [10, 1440], sessions: [makeSession({ day: 1, start: '00:05' })] });
    await syncReminders([course], true);
    expect(triggers()).toEqual([
      expect.objectContaining({ weekday: 2, hour: 23, minute: 55 }), // Pzt 23:55
      expect.objectContaining({ weekday: 2, hour: 0, minute: 5 }), // Pzt 00:05
    ]);
  });

  it(`${MAX_SCHEDULED} sınırını aşmaz; önce her oturumun en kısa hatırlatmasını kurar`, async () => {
    expect(MAX_SCHEDULED).toBe(64);
    // 7 ders × 5 oturum = 35 oturum; 3 hatırlatma → 105 bildirim isteniyor
    const courses = Array.from({ length: 7 }, (_, i) =>
      makeCourse({
        code: `D${i}`,
        reminders: [120, 10, 30],
        sessions: Array.from({ length: 5 }, (_, d) => makeSession({ day: d, start: '10:00' })),
      }),
    );
    await expect(syncReminders(courses, true)).resolves.toBeUndefined();
    const titles = scheduled().map((r) => String(r.content.title));
    expect(titles).toHaveLength(64);
    // 35 oturumun hepsine 10 dk, kalan 29 yere 30 dk; 2 sa hiç sığmaz
    expect(titles.filter((t) => t.endsWith('10 dk sonra'))).toHaveLength(35);
    expect(titles.filter((t) => t.endsWith('30 dk sonra'))).toHaveLength(29);
    expect(titles.filter((t) => t.endsWith('2 sa sonra'))).toHaveLength(0);
  });

  it('sınırın altındaysa hepsini kurar', async () => {
    const course = makeCourse({
      reminders: [5, 10, 15, 30],
      sessions: Array.from({ length: 16 }, () => makeSession()),
    });
    await syncReminders([course], true);
    expect(scheduled()).toHaveLength(64);
  });
});

describe('useReminderSync', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const flush = async () => {
    await jest.advanceTimersByTimeAsync(500);
  };

  it('veri yüklenmeden senkron yapmaz', async () => {
    await renderHook(() => useReminderSync([], true, false));
    await flush();
    expect(N.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });

  it('500 ms gecikmeyle senkron yapar ve ardışık değişiklikleri birleştirir', async () => {
    const a = [makeCourse({ sessions: [makeSession()] })];
    const b = [makeCourse({ code: 'SON', sessions: [makeSession()] })];
    const { rerender } = await renderHook(({ courses }: { courses: Course[] }) => useReminderSync(courses, true, true), {
      initialProps: { courses: a },
    });
    await jest.advanceTimersByTimeAsync(200);
    await rerender({ courses: b });
    await jest.advanceTimersByTimeAsync(499);
    expect(N.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(scheduled()).toHaveLength(1);
    expect(scheduled()[0].content.title).toMatch(/^SON /);
  });
});
