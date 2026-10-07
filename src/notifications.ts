import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { Course } from './types';

// Web'de zamanlanmış yerel bildirim desteklenmiyor
export const notificationsSupported = Platform.OS !== 'web';

const CHANNEL_ID = 'class-reminders';

// Seçilebilir hatırlatma süreleri (dakika); hiçbiri seçili değilse hatırlatma kapalı
export const REMINDER_VALUES = [5, 10, 15, 30, 60, 120, 1440];

const DAY_MIN = 24 * 60;
const WEEK_MIN = 7 * DAY_MIN;

// iOS aynı anda en fazla 64 planlı yerel bildirim tutar; fazlası sessizce düşer
export const MAX_SCHEDULED = 64;

// 1440 → "1 gün", 120 → "2 sa", 90 → "90 dk"
export function leadLabel(min: number) {
  if (min >= DAY_MIN && min % DAY_MIN === 0) return `${min / DAY_MIN} gün`;
  if (min >= 60 && min % 60 === 0) return `${min / 60} sa`;
  return `${min} dk`;
}

export const REMINDER_OPTIONS = REMINDER_VALUES.map((value) => ({ value, label: leadLabel(value) }));

// [60, 10] → "Hatırlatma: 1 sa, 10 dk önce"; boş liste → "Hatırlatma yok"
export function reminderSummary(reminders: number[]) {
  const list = [...new Set(reminders)].sort((a, b) => b - a);
  return list.length ? `Hatırlatma: ${list.map(leadLabel).join(', ')} önce` : 'Hatırlatma yok';
}

if (notificationsSupported) {
  // Uygulama açıkken gelen bildirim de banner olarak gösterilsin
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission() {
  if (!notificationsSupported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Ders hatırlatmaları',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Tüm hatırlatmaları silip güncel ders listesine göre haftalık tekrarlı olarak yeniden kurar
export async function syncReminders(courses: Course[], enabled: boolean) {
  if (!notificationsSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;

  const targets = courses.filter((c) => c.reminders.length > 0 && c.sessions.length > 0);
  if (targets.length === 0 || !(await ensurePermission())) return;

  // Her (oturum × hatırlatma) için bir bildirim. rank = oturum içindeki sıra (en kısa süre 0).
  const plans = targets.flatMap((course) =>
    course.sessions.flatMap((session) =>
      [...new Set(course.reminders)]
        .sort((a, b) => a - b)
        .map((lead, rank) => ({ course, session, lead, rank })),
    ),
  );
  // 64 sınırını aşarsa önce her oturumun en kısa hatırlatması, sonra ikincisi… sığdığı kadar kurulur
  const chosen = plans.length > MAX_SCHEDULED
    ? plans.map((p, i) => ({ p, i })).sort((a, b) => a.p.rank - b.p.rank || a.i - b.i).slice(0, MAX_SCHEDULED).map(({ p }) => p)
    : plans;

  for (const { course, session, lead } of chosen) {
    // Haftanın başından (Pzt 00:00) itibaren dakika; gün/hafta sınırını geçerse geriye sarar
    const at = (((session.day * DAY_MIN + toMinutes(session.start) - lead) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
    const day = Math.floor(at / DAY_MIN);
    const min = at % DAY_MIN;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${course.code} · ${leadLabel(lead)} sonra`,
        body: `${course.name} — ${session.start}${session.room ? `, ${session.room}` : ''}`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: CHANNEL_ID,
        weekday: ((day + 1) % 7) + 1, // 0 = Pazartesi → 2, 6 = Pazar → 1
        hour: Math.floor(min / 60),
        minute: min % 60,
      },
    });
  }
}

let queue: Promise<void> = Promise.resolve();

// Ders veya ayar değiştikçe hatırlatmaları arka planda yeniden kurar
export function useReminderSync(courses: Course[], enabled: boolean, loaded: boolean) {
  useEffect(() => {
    if (!loaded || !notificationsSupported) return;
    const t = setTimeout(() => {
      queue = queue.then(() => syncReminders(courses, enabled)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [courses, enabled, loaded]);
}
