import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { uid } from '../../store';
import { colors, courseColors, DAYS_SHORT, radius } from '../../theme';
import type { Course, Session } from '../../types';

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

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
  const [sessions, setSessions] = useState<SessionDraft[]>(
    initial ? initial.sessions.map((s) => ({ ...s })) : [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateSession = (id: string, patch: Partial<SessionDraft>) =>
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

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
      sessions: cleanSessions,
      status: initial?.status ?? 'active',
      letterGrade: initial?.letterGrade ?? null,
      assessments: initial?.assessments ?? [],
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>{initial ? 'Dersi Düzenle' : 'Yeni Ders'}</Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }}>
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
                  <View style={styles.row}>
                    <Field label="Başlangıç" style={{ width: 110 }}>
                      <TextInput
                        value={s.start}
                        onChangeText={(t) => updateSession(s.id, { start: t })}
                        placeholder="09:00"
                        maxLength={5}
                        style={[styles.input, err && styles.inputError]}
                      />
                    </Field>
                    <Field label="Bitiş" style={{ width: 110 }}>
                      <TextInput
                        value={s.end}
                        onChangeText={(t) => updateSession(s.id, { end: t })}
                        placeholder="11:50"
                        maxLength={5}
                        style={[styles.input, err && styles.inputError]}
                      />
                    </Field>
                    <Field label="Derslik" style={{ flex: 1 }}>
                      <TextInput
                        value={s.room}
                        onChangeText={(t) => updateSession(s.id, { room: t })}
                        placeholder="ör. B-204"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  {err && <Text style={styles.error}>{err}</Text>}
                </View>
              );
            })}

            <Field label="Notlar">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Ders hakkında notlar…"
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              />
            </Field>
          </ScrollView>

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
      </View>
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
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  close: { fontSize: 18, color: colors.textMuted },
  body: { paddingHorizontal: 24, paddingTop: 18 },
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
    paddingHorizontal: 24,
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
