import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensurePermission, notificationsSupported, reminderSummary } from '../notifications';
import { useStore } from '../store';
import { colors, DAYS, radius } from '../theme';
import type { Course, Route, Session } from '../types';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

interface Item {
  course: Course;
  session: Session;
  startMin: number;
  endMin: number;
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const mondayOf = (d: Date) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const todayIndexOf = (d: Date) => (d.getDay() + 6) % 7;

function formatRange(start: Date, end: Date) {
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

function tint(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const TIME_COL_ESTIMATE = 60;
const GAP = 8;
const HEADER_H = 52;
const CARD_H = 112;
const MIN_COL = 96; // bundan dar sütun gerekiyorsa tablo yana kaydırılır
const SCROLL_COL = 112;

// Bir zaman bandı: saatleri birbirine değen/çakışan derslerin oluşturduğu satır
interface Slot {
  key: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  cells: Item[][]; // gösterilen gün sütunlarına göre
}

const rowHeight = (slot: Slot) => {
  const stack = Math.max(1, ...slot.cells.map((c) => c.length));
  return stack * CARD_H + (stack - 1) * 6;
};

export default function HomeScreen({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { data, updateSettings } = useStore();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selected, setSelected] = useState<Item | null>(null);
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const gridScroll = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo(() => {
    const list: Item[] = [];
    for (const course of data.courses) {
      for (const session of course.sessions) {
        const startMin = toMinutes(session.start);
        const endMin = toMinutes(session.end);
        if (endMin > startMin && session.day >= 0 && session.day <= 6) {
          list.push({ course, session, startMin, endMin });
        }
      }
    }
    return list;
  }, [data.courses]);

  // Hafta içi her zaman, hafta sonu yalnızca dersi varsa gösterilir
  const days = useMemo(
    () => DAYS.map((_, i) => i).filter((i) => i < 5 || items.some((b) => b.session.day === i)),
    [items],
  );

  // Saatleri çakışan oturumlar (hangi günde olursa olsun) tek bir zaman bandında toplanır;
  // ör. 19:45–21:50 ve 19:55–20:30 aynı satırda, 19:45–21:50 bandında görünür
  const slots = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
    const list: Slot[] = [];
    for (const b of sorted) {
      let slot = list[list.length - 1];
      if (!slot || b.startMin >= slot.endMin) {
        slot = { key: b.session.start, start: b.session.start, end: b.session.end, startMin: b.startMin, endMin: b.endMin, cells: days.map(() => []) };
        list.push(slot);
      } else if (b.endMin > slot.endMin) {
        slot.end = b.session.end;
        slot.endMin = b.endMin;
      }
      slot.cells[days.indexOf(b.session.day)].push(b);
    }
    list.forEach((slot) =>
      slot.cells.forEach((c) =>
        c.sort((a, b) => a.startMin - b.startMin || a.course.code.localeCompare(b.course.code, 'tr')),
      ),
    );
    return list;
  }, [items, days]);

  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));
  const isCurrentWeek = sameDay(weekStart, mondayOf(now));
  const todayIndex = isCurrentWeek ? todayIndexOf(now) : -1;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const courseCount = new Set(items.map((b) => b.course.id)).size;

  // Ekrana sığıyorsa sütunlar genişliği paylaşır, sığmıyorsa sabit genişlikle yana kayar
  // Ölçüm gelene kadar (ilk çizim) pencere genişliğinden tahmin edilir
  const available = gridWidth ?? width - 32 - TIME_COL_ESTIMATE;
  const fitWidth = (available - GAP * (days.length - 1)) / days.length;
  const scrolls = fitWidth < MIN_COL;
  const colW = scrolls ? SCROLL_COL : fitWidth;

  // Kaydırılan tabloda bugünün sütunu görünür olsun
  useEffect(() => {
    const col = days.indexOf(todayIndex);
    if (scrolls && col > 0) gridScroll.current?.scrollTo?.({ x: col * (colW + GAP), animated: false });
  }, [scrolls, colW, todayIndex, days, slots.length]);

  const goToday = () => setWeekStart(mondayOf(new Date()));

  const notificationsOn = data.settings.notifications;
  const toggleNotifications = async () => {
    if (notificationsOn) {
      updateSettings({ notifications: false });
      return;
    }
    if (await ensurePermission()) {
      updateSettings({ notifications: true });
    } else {
      Alert.alert('Bildirim izni yok', 'Ders hatırlatmaları için telefon ayarlarından Simestr bildirimlerine izin ver.');
    }
  };

  return (
    <View style={styles.screen}>
      {/* Başlık ve hafta gezinmesi */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Program</Text>
          <Text style={styles.subtitle}>
            {formatRange(weekDates[0], weekDates[6])}
            {courseCount > 0 ? ` · ${courseCount} ders` : ''}
          </Text>
        </View>
        {!isCurrentWeek && (
          <Pressable style={styles.todayBtn} onPress={goToday} hitSlop={6}>
            <Text style={styles.todayBtnText}>Bugün</Text>
          </Pressable>
        )}
        {notificationsSupported && (
          <Pressable
            style={styles.iconBtn}
            onPress={toggleNotifications}
            hitSlop={6}
            accessibilityLabel={notificationsOn ? 'Hatırlatmaları kapat' : 'Hatırlatmaları aç'}
          >
            <Ionicons
              name={notificationsOn ? 'notifications' : 'notifications-off-outline'}
              size={19}
              color={notificationsOn ? colors.primary : colors.textMuted}
            />
          </Pressable>
        )}
        <Pressable
          style={styles.iconBtn}
          onPress={() => setWeekStart((w) => addDays(w, -7))}
          hitSlop={6}
          accessibilityLabel="Önceki hafta"
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.iconBtn}
          onPress={() => setWeekStart((w) => addDays(w, 7))}
          hitSlop={6}
          accessibilityLabel="Sonraki hafta"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      {slots.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Henüz ders eklemedin</Text>
          <Text style={styles.emptyText}>Derslerini ve saatlerini eklediğinde programın burada görünecek.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => onNavigate('courses')}>
            <Text style={styles.primaryBtnText}>Ders ekle</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={{ flexDirection: 'row' }}>
            {/* Sabit saat sütunu: başlangıç üstte, bitiş altta */}
            {/* Genişliği sabit değil, saat yazısına göre belirlenir; böylece büyük
                yazı boyutunda bile saat alt satıra kaymaz */}
            <View style={styles.timeCol}>
              <View style={styles.dayHeaderSpacer} />
              {slots.map((slot) => (
                <View key={slot.key} style={[styles.timeCell, { height: rowHeight(slot) }]}>
                  <Text style={styles.time} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                    {slot.start}
                  </Text>
                  <Text style={[styles.time, styles.timeEnd]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                    {slot.end}
                  </Text>
                </View>
              ))}
            </View>

            {/* Gün sütunları: saat sütunundan kalan gerçek genişliğe göre yerleşir */}
            <ScrollView
              ref={gridScroll}
              horizontal
              scrollEnabled={scrolls}
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
            >
              <View>
                <View style={[styles.gridRow, styles.dayHeaderRow]}>
                  {days.map((d, ci) => {
                    const busy = slots.some((s) => s.cells[ci].length > 0);
                    const today = d === todayIndex;
                    return (
                      <View
                        key={d}
                        style={[
                          styles.dayHeader,
                          { width: colW, borderBottomColor: today ? colors.primary : busy ? colors.text : colors.border },
                        ]}
                      >
                        <Text
                          style={[styles.dayName, !busy && { color: colors.textMuted }, today && { color: colors.primary }]}
                          numberOfLines={1}
                        >
                          {DAYS[d].toLocaleUpperCase('tr-TR')}
                        </Text>
                        <Text style={[styles.dayDate, today && { color: colors.primary }]}>
                          {weekDates[d].getDate()} {MONTHS[weekDates[d].getMonth()].slice(0, 3)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {slots.map((slot) => (
                  <View key={slot.key} style={[styles.gridRow, { height: rowHeight(slot), marginBottom: GAP }]}>
                    {slot.cells.map((cell, ci) => {
                      if (cell.length === 0) {
                        return <View key={ci} style={[styles.emptyCell, { width: colW }]} />;
                      }
                      const today = days[ci] === todayIndex;
                      return (
                        <View key={ci} style={{ width: colW, gap: 6 }}>
                          {cell.map((b) => {
                            const ongoing = today && nowMin >= b.startMin && nowMin < b.endMin;
                            const past = today && nowMin >= b.endMin;
                            // Saati bandın saatinden farklıysa kartta kendi saati yazılır
                            const ownTime =
                              b.startMin !== slot.startMin || b.endMin !== slot.endMin
                                ? `${b.session.start}–${b.session.end}`
                                : '';
                            return (
                              <Pressable
                                key={b.session.id}
                                onPress={() => setSelected(b)}
                                style={({ pressed }) => [
                                  styles.card,
                                  {
                                    height: cell.length === 1 ? rowHeight(slot) : CARD_H,
                                    backgroundColor: tint(b.course.color, 0.12),
                                    borderColor: b.course.color,
                                  },
                                  ongoing && styles.cardOngoing,
                                  past && { opacity: 0.5 },
                                  pressed && { opacity: 0.7 },
                                ]}
                              >
                                <View style={[styles.codePill, { backgroundColor: b.course.color }]}>
                                  <Text style={styles.codePillText} numberOfLines={1}>
                                    {b.course.code}
                                  </Text>
                                </View>
                                <Text style={styles.cardName} numberOfLines={ownTime ? 2 : 3}>
                                  {b.course.name}
                                </Text>
                                <View style={{ flex: 1 }} />
                                {ongoing ? (
                                  <Text style={[styles.cardFoot, { color: b.course.color, fontWeight: '800' }]}>Şimdi</Text>
                                ) : ownTime || b.session.room ? (
                                  <Text style={styles.cardFoot} numberOfLines={1}>
                                    {[ownTime, b.session.room].filter(Boolean).join(' · ')}
                                  </Text>
                                ) : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      <DetailSheet item={selected} notificationsOn={notificationsOn} onClose={() => setSelected(null)} />
    </View>
  );
}

function DetailSheet({
  item,
  notificationsOn,
  onClose,
}: {
  item: Item | null;
  notificationsOn: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {item && (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={[styles.cardCode, { color: item.course.color }]}>{item.course.code}</Text>
            <Text style={styles.sheetTitle}>{item.course.name}</Text>
            <View style={styles.sheetRows}>
              <DetailRow
                icon="time-outline"
                value={`${DAYS[item.session.day]}, ${item.session.start}–${item.session.end}`}
              />
              <DetailRow icon="location-outline" value={item.session.room || 'Derslik belirtilmedi'} />
              <DetailRow icon="person-outline" value={item.course.instructor || 'Öğretim üyesi belirtilmedi'} />
              {notificationsSupported && (
                <DetailRow
                  icon="notifications-outline"
                  value={
                    notificationsOn
                      ? reminderSummary(item.course.reminders)
                      : 'Hatırlatmalar kapalı'
                  }
                />
              )}
              <DetailRow
                icon="school-outline"
                value={`${item.course.credits} AKTS${item.course.semester ? ` · ${item.course.semester}` : ''}`}
              />
            </View>
            {item.course.notes ? <Text style={styles.sheetNotes}>{item.course.notes}</Text> : null}
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

function DetailRow({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    marginRight: 2,
  },
  todayBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24 },
  dayHeaderSpacer: { height: HEADER_H },
  dayHeaderRow: { height: HEADER_H - GAP, marginBottom: GAP },
  gridRow: { flexDirection: 'row', gap: GAP },
  dayHeader: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6, borderBottomWidth: 2 },
  dayName: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.text },
  dayDate: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  timeCol: { minWidth: 52, flexShrink: 0, paddingRight: 10 },
  timeCell: { marginBottom: GAP, paddingTop: 10, alignItems: 'flex-end' },
  time: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  timeEnd: { color: colors.textMuted, fontWeight: '600', marginTop: 2 },

  emptyCell: { borderRadius: radius.lg, backgroundColor: '#EDEFF4' },
  card: { borderRadius: radius.lg, borderWidth: 1.5, padding: 10, gap: 6, overflow: 'hidden' },
  cardOngoing: { borderWidth: 2.5 },
  codePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, maxWidth: '100%' },
  codePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 18 },
  cardFoot: { fontSize: 12, color: colors.textMuted },
  cardCode: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },

  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 4,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sheetRows: { marginTop: 16, gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailValue: { fontSize: 15, color: colors.text, flexShrink: 1 },
  sheetNotes: { fontSize: 14, color: colors.textMuted, marginTop: 16, lineHeight: 20 },
});
