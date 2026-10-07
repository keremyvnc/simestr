import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { notificationsSupported, REMINDER_OPTIONS, reminderSummary } from '../../notifications';
import { DEFAULT_REMINDERS, normalizeReminders, uid } from '../../store';
import { colors, courseColors, DAYS_SHORT, radius } from '../../theme';
import type { Course, Session } from '../../types';
import { FormScrollView, KeyboardAvoidingBackdrop } from '../KeyboardAware';
import TimeField, { TimeWheel } from '../TimeField';

export type CourseInput = Omit<Course, 'id' | 'createdAt'>;

interface SessionDraft {
  id: string;
  day: number;
  start: string;
  end: string;
  room: string;
}

interface Props {
  visible: boolean;
  initial: Course | null; // null → yeni ders
  onCancel: () => void;
  onSubmit: (value: CourseInput) => void;
}

const BACKDROP_COLOR = 'rgba(15, 23, 42, 0.45)';

const TIME_RE =/^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// "9:00" → "09:00" gibi küçük düzeltmeler
const normalizeTime = (t: string) => {
  const trimmed = t.trim().replace('.', ':');
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : trimmed;
};

const newSession = (): SessionDraft => ({ id: uid(), day: 0, start: '09:00', end: '11:50', room: '' });

export default function CourseForm({ visible, initial, onCancel, onSubmit }: Props) {
  // Modal her açılışta yeniden mount edilir (key ile), bu yüzden başlangıç durumu burada kurulur
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [instructor, setInstructor] = useState(initial?.instructor ?? '');
  const [credits, setCredits] = useState(initial ? String(initial.credits) : '7.5');
  const [semester, setSemester] = useState(initial?.semester ?? '2026-2027 Güz');
  const [color, setColor] = useState(initial?.color ?? courseColors[0]);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [reminders, setReminders] = useState<number[]>(initial ? initial.reminders : DEFAULT_REMINDERS);
  const toggleReminder = (value: number) =>
    setReminders((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
  const [sessions, setSessions] = useState<SessionDraft[]>(
    initial ? initial.sessions.map((s) => ({ ...s })) : [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateSession = (id: string, patch: Partial<SessionDraft>) =>
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  // iOS'ta açık olan saat tekerleği: "<oturumId>:start" | "<oturumId>:end"
  const [openTime, setOpenTime] = useState<string | null>(null);
  const toggleTime = (key: string) => setOpenTime((k) => (k === key ? null : key));

  // Başlangıç değişince bitiş geride kalırsa süreyi koruyarak bitişi de kaydır
  const changeStart = (s: SessionDraft, start: string) => {
    const patch: Partial<SessionDraft> = { start };
    const oldStart = normalizeTime(s.start);
    const end = normalizeTime(s.end);
    if (TIME_RE.test(start) && TIME_RE.test(end) && toMinutes(end) <= toMinutes(start)) {
      const prevDuration =
        TIME_RE.test(oldStart) && toMinutes(end) > toMinutes(oldStart) ? toMinutes(end) - toMinutes(oldStart) : 50;
      const e = Math.min(toMinutes(start) + prevDuration, 23 * 60 + 55);
      if (e > toMinutes(start)) {
        patch.end = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
      }
    }
    updateSession(s.id, patch);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = 'Ders kodu zorunlu.';
    if (!name.trim()) e.name = 'Ders adı zorunlu.';
    const cr = Number(credits.replace(',', '.'));
    if (!credits.trim() || Number.isNaN(cr) || cr <= 0) e.credits = 'Geçerli bir AKTS girin (ör. 7.5).';
    sessions.forEach((s) => {
      const start = normalizeTime(s.start);
      const end = normalizeTime(s.end);
      if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
        e[`session-${s.id}`] = 'Saatleri SS:DD biçiminde girin (ör. 09:00).';
      } else if (toMinutes(end) <= toMinutes(start)) {
        e[`session-${s.id}`] = 'Bitiş saati başlangıçtan sonra olmalı.';
      }
    });
    return e;
  };

  const handleSave = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const cleanSessions: Session[] = sessions
      .map((s) => ({
        id: s.id,
        day: s.day,
        start: normalizeTime(s.start),
        end: normalizeTime(s.end),
        room: s.room.trim(),
      }))
      .sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start));

    onSubmit({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      instructor: instructor.trim(),
      credits: Number(credits.replace(',', '.')),
      semester: semester.trim(),
      color,
      notes: notes.trim(),
      reminders: normalizeReminders(reminders),
      sessions: cleanSessions,
      letterGrade: initial?.letterGrade ?? null,
      assessments: initial?.assessments ?? [],
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingBackdrop style={styles.backdrop} backdropColor={BACKDROP_COLOR}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>{initial ? 'Dersi Düzenle' : 'Yeni Ders'}</Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <FormScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={styles.row}>
              <Field label="Ders kodu *" error={errors.code} style={{ flex: 1 }}>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="ör. BIL501"
                  style={[styles.input, errors.code && styles.inputError]}
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="AKTS" error={errors.credits} style={{ width: 120 }}>
                <TextInput
                  value={credits}
                  onChangeText={setCredits}
                  keyboardType="decimal-pad"
                  style={[styles.input, errors.credits && styles.inputError]}
                />
              </Field>
            </View>

            <Field label="Ders adı *" error={errors.name}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="ör. İleri Algoritma Analizi"
                style={[styles.input, errors.name && styles.inputError]}
              />
            </Field>

            <View style={styles.row}>
              <Field label="Öğretim üyesi" style={{ flex: 1 }}>
                <TextInput
                  value={instructor}
                  onChangeText={setInstructor}
                  placeholder="ör. Prof. Dr. Ayşe Yılmaz"
                  style={styles.input}
                />
              </Field>
              <Field label="Dönem" style={{ flex: 1 }}>
                <TextInput value={semester} onChangeText={setSemester} style={styles.input} />
              </Field>
            </View>

            <Field label="Renk">
              <View style={styles.colorRow}>
                {courseColors.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                  />
                ))}
              </View>
            </Field>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ders saatleri</Text>
              <Pressable onPress={() => setSessions((l) => [...l, newSession()])} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>+ Saat ekle</Text>
              </Pressable>
            </View>
            {sessions.length === 0 && (
              <Text style={styles.hint}>
                Haftalık programda görünmesi için en az bir ders saati ekleyin.
              </Text>
            )}
            {sessions.map((s) => {
              const err = errors[`session-${s.id}`];
              return (
                <View key={s.id} style={styles.sessionBox}>
                  <View style={styles.dayRow}>
                    {DAYS_SHORT.map((d, i) => (
                      <Pressable
                        key={d}
                        onPress={() => updateSession(s.id, { day: i })}
                        style={[styles.dayChip, s.day === i && { backgroundColor: color, borderColor: color }]}
                      >
                        <Text style={[styles.dayChipText, s.day === i && { color: '#FFFFFF' }]}>{d}</Text>
                      </Pressable>
                    ))}
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={() => setSessions((l) => l.filter((x) => x.id !== s.id))}
                      hitSlop={8}
                    >
                      <Text style={styles.removeText}>Kaldır</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    <Field label="Başlangıç" style={{ width: 100 }}>
                      <TimeField
                        value={s.start}
                        onChange={(t) => changeStart(s, t)}
                        error={!!err}
                        active={openTime === `${s.id}:start`}
                        onPress={() => toggleTime(`${s.id}:start`)}
                      />
                    </Field>
                    <Field label="Bitiş" style={{ width: 100 }}>
                      <TimeField
                        value={s.end}
                        onChange={(t) => updateSession(s.id, { end: t })}
                        error={!!err}
                        active={openTime === `${s.id}:end`}
                        onPress={() => toggleTime(`${s.id}:end`)}
                      />
                    </Field>
                    <Field label="Derslik" style={{ flex: 1, minWidth: 120 }}>
                      <TextInput
                        value={s.room}
                        onChangeText={(t) => updateSession(s.id, { room: t })}
                        placeholder="ör. B-204"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  {openTime?.startsWith(`${s.id}:`) && (
                    <TimeWheel
                      key={openTime}
                      value={openTime.endsWith(':start') ? s.start : s.end}
                      onChange={(t) =>
                        openTime.endsWith(':start') ? changeStart(s, t) : updateSession(s.id, { end: t })
                      }
                      onDone={() => setOpenTime(null)}
                    />
                  )}
                  {err && <Text style={styles.error}>{err}</Text>}
                </View>
              );
            })}

            {notificationsSupported && (
              <Field label="Dersten önce hatırlat (birden fazla seçilebilir)">
                <View style={[styles.dayRow, { marginBottom: 6 }]}>
                  {[{ value: null, label: 'Kapalı' }, ...REMINDER_OPTIONS].map((o) => {
                    // "Kapalı" hiçbir süre seçili değilken aktif görünür; basınca tümünü temizler
                    const active = o.value === null ? reminders.length === 0 : reminders.includes(o.value);
                    return (
                      <Pressable
                        key={o.label}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: active }}
                        onPress={() => (o.value === null ? setReminders([]) : toggleReminder(o.value))}
                        style={[styles.dayChip, active && { backgroundColor: color, borderColor: color }]}
                      >
                        <Text style={[styles.dayChipText, active && { color: '#FFFFFF' }]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.hint}>{reminderSummary(reminders)}</Text>
              </Field>
            )}

            <Field label="Notlar">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Ders hakkında notlar…"
                style={[styles.input, { minHeight: 72, maxHeight: 160, textAlignVertical: 'top' }]}
              />
            </Field>
          </FormScrollView>

          <View style={styles.footer}>
            {Object.keys(errors).length > 0 && (
              <Text style={[styles.error, { flex: 1, marginTop: 0 }]}>Lütfen işaretli alanları düzeltin.</Text>
            )}
            <View style={{ flex: Object.keys(errors).length > 0 ? 0 : 1 }} />
            <Pressable onPress={onCancel} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Vazgeç</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{initial ? 'Kaydet' : 'Dersi Ekle'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingBackdrop>
    </Modal>
  );
}

function Field({
  label,
  error,
  style,
  children,
}: {
  label: string;
  error?: string;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  dialog: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  close: { fontSize: 18, color: colors.textMuted },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: 'transparent' },
  colorDotActive: { borderColor: colors.text },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
  smallBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  smallBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  sessionBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    paddingBottom: 0,
    marginBottom: 12,
    backgroundColor: colors.bg,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  dayChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  removeText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm },
  secondaryBtnText: { color: colors.textMuted, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
});
