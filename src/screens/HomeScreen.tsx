import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { colors, DAYS, DAYS_SHORT, radius } from '../theme';
import type { Course, Route, Session } from '../types';

const HOUR_HEIGHT = 56;
const AXIS_WIDTH = 56;
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

interface Block {
  course: Course;
  session: Session;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
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

function formatRange(start: Date, end: Date) {
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

function tint(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Çakışan oturumları yan yana sütunlara yerleştirir.
function layoutDay(items: Omit<Block, 'col' | 'cols'>[]): Block[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result: Block[] = [];
  let cluster: Block[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = colEnds.length;
    cluster.forEach((b) => (b.cols = cols));
    result.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const item of sorted) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= item.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.endMin);
    } else {
      colEnds[col] = item.endMin;
    }
    cluster.push({ ...item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length) flush();
  return result;
}

export default function HomeScreen({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { data } = useStore();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<Block | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const activeCourses = useMemo(() => data.courses.filter((c) => c.status === 'active'), [data.courses]);

  const items = useMemo(
    () =>
      activeCourses.flatMap((course) =>
        course.sessions
          .map((session) => ({ course, session, startMin: toMinutes(session.start), endMin: toMinutes(session.end) }))
          .filter((b) => b.endMin > b.startMin && b.session.day >= 0 && b.session.day <= 6),
      ),
    [activeCourses],
  );

  const { startHour, endHour } = useMemo(() => {
    let s = 8;
    let e = 20;
    for (const b of items) {
      s = Math.min(s, Math.floor(b.startMin / 60));
      e = Math.max(e, Math.ceil(b.endMin / 60));
    }
    return { startHour: Math.max(0, s), endHour: Math.min(24, e) };
  }, [items]);

  const blocksByDay = useMemo(
    () => DAYS.map((_, day) => layoutDay(items.filter((b) => b.session.day === day))),
    [items],
  );

  const totalMinutes = items.reduce((sum, b) => sum + (b.endMin - b.startMin), 0);
  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));
  const todayIndex = weekDates.findIndex((d) => sameDay(d, now));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNowLine = todayIndex !== -1 && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT;
  const isCurrentWeek = sameDay(weekStart, mondayOf(now));

  return (
    <View style={styles.screen}>
      {/* Üst bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Haftalık Program</Text>
          <Text style={styles.subtitle}>{formatRange(weekDates[0], weekDates[6])}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{activeCourses.length}</Text>
            <Text style={styles.statLabel}>Aktif ders</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {Math.floor(totalMinutes / 60)}
              {totalMinutes % 60 ? `.${Math.round(((totalMinutes % 60) / 60) * 10)}` : ''} sa
            </Text>
            <Text style={styles.statLabel}>Haftalık ders saati</Text>
          </View>
          <View style={styles.navGroup}>
            <Pressable style={styles.navBtn} onPress={() => setWeekStart((w) => addDays(w, -7))}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Pressable
              style={[styles.todayBtn, isCurrentWeek && styles.todayBtnDisabled]}
              onPress={() => setWeekStart(mondayOf(new Date()))}
            >
              <Text style={[styles.todayBtnText, isCurrentWeek && { color: colors.textMuted }]}>Bugün</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => setWeekStart((w) => addDays(w, 7))}>
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.calendar}>
        {/* Gün başlıkları */}
        <View style={styles.dayHeaderRow}>
          <View style={{ width: AXIS_WIDTH }} />
          {weekDates.map((d, i) => {
            const isToday = i === todayIndex;
            return (
              <View key={i} style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                <Text style={[styles.dayName, isToday && { color: colors.primary }]}>{DAYS_SHORT[i]}</Text>
                <View style={[styles.dayNum, isToday && styles.dayNumToday]}>
                  <Text style={[styles.dayNumText, isToday && { color: '#FFFFFF' }]}>{d.getDate()}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
          <View style={[styles.gridRow, { height: gridHeight + 12 }]}>
            {/* Saat ekseni */}
            <View style={{ width: AXIS_WIDTH, height: gridHeight }}>
              {hours.map((h, i) => (
                <Text key={h} style={[styles.hourLabel, { top: i * HOUR_HEIGHT - 7 }]}>
                  {String(h).padStart(2, '0')}:00
                </Text>
              ))}
            </View>

            {/* Gün sütunları */}
            {DAYS.map((_, day) => (
              <View
                key={day}
                style={[styles.dayCol, { height: gridHeight }, day === todayIndex && styles.dayColToday]}
              >
                {hours.map((h, i) => (
                  <View key={h} style={[styles.hourLine, { top: i * HOUR_HEIGHT }]} />
                ))}
                {blocksByDay[day].map((b) => {
                  const top = ((b.startMin - startHour * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(((b.endMin - b.startMin) / 60) * HOUR_HEIGHT - 2, 20);
                  const width = 100 / b.cols;
                  const compact = height < 50;
                  return (
                    <Pressable
                      key={b.session.id}
                      onPress={() => setSelected(b)}
                      style={(state) => [
                        styles.block,
                        {
                          top,
                          height,
                          left: `${b.col * width}%`,
                          width: `${width}%`,
                          backgroundColor: tint(b.course.color, (state as { hovered?: boolean }).hovered ? 0.24 : 0.14),
                          borderLeftColor: b.course.color,
                        },
                      ]}
                    >
                      <Text style={[styles.blockCode, { color: b.course.color }]} numberOfLines={1}>
                        {b.course.code || b.course.name}
                      </Text>
                      {!compact && (
                        <>
                          <Text style={styles.blockName} numberOfLines={2}>
                            {b.course.name}
                          </Text>
                          <Text style={styles.blockMeta} numberOfLines={1}>
                            {b.session.start}–{b.session.end}
                            {b.session.room ? ` · ${b.session.room}` : ''}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
                {showNowLine && day === todayIndex && (
                  <View style={[styles.nowLine, { top: ((nowMin - startHour * 60) / 60) * HOUR_HEIGHT }]}>
                    <View style={styles.nowDot} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {items.length === 0 && (
          <View style={styles.emptyOverlay} pointerEvents="box-none">
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Henüz ders eklemedin</Text>
              <Text style={styles.emptyText}>
                Derslerini ve gün/saatlerini eklediğinde haftalık programın burada görünecek.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => onNavigate('courses')}>
                <Text style={styles.primaryBtnText}>Ders ekle</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Ders detay paneli */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          {selected && (
            <Pressable style={styles.detailCard} onPress={() => {}}>
              <View style={[styles.detailStripe, { backgroundColor: selected.course.color }]} />
              <Text style={[styles.detailCode, { color: selected.course.color }]}>{selected.course.code}</Text>
              <Text style={styles.detailName}>{selected.course.name}</Text>
              <View style={styles.detailRows}>
                <DetailRow label="Öğretim üyesi" value={selected.course.instructor || '—'} />
                <DetailRow label="AKTS" value={String(selected.course.credits ?? '—')} />
                <DetailRow
                  label="Gün / saat"
                  value={`${DAYS[selected.session.day]}, ${selected.session.start}–${selected.session.end}`}
                />
                <DetailRow label="Derslik" value={selected.session.room || '—'} />
                {selected.course.semester ? <DetailRow label="Dönem" value={selected.course.semester} /> : null}
              </View>
              <Pressable style={[styles.primaryBtn, { alignSelf: 'flex-end' }]} onPress={() => setSelected(null)}>
                <Text style={styles.primaryBtnText}>Kapat</Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 28, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 96,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  navGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 20, color: colors.text, lineHeight: 22 },
  todayBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  todayBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  todayBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  calendar: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dayHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  dayHeader: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4 },
  dayHeaderToday: { backgroundColor: colors.primarySoft },
  dayName: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  dayNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayNumToday: { backgroundColor: colors.primary },
  dayNumText: { fontSize: 15, fontWeight: '700', color: colors.text },

  gridRow: { flexDirection: 'row', paddingTop: 12 },
  hourLabel: { position: 'absolute', right: 8, fontSize: 11, color: colors.textMuted },
  dayCol: { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, position: 'relative' },
  dayColToday: { backgroundColor: 'rgba(79, 70, 229, 0.03)' },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },

  block: {
    position: 'absolute',
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  blockCode: { fontSize: 12, fontWeight: '800' },
  blockName: { fontSize: 12, color: colors.text, marginTop: 1 },
  blockMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.danger, zIndex: 10 },
  nowDot: {
    position: 'absolute',
    left: -5,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },

  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 247, 251, 0.6)',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    maxWidth: 380,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', alignItems: 'center', justifyContent: 'center' },
  detailCard: {
    width: 380,
    maxWidth: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    paddingTop: 28,
    overflow: 'hidden',
    gap: 4,
  },
  detailStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },
  detailCode: { fontSize: 13, fontWeight: '800' },
  detailName: { fontSize: 20, fontWeight: '800', color: colors.text },
  detailRows: { marginVertical: 16, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
