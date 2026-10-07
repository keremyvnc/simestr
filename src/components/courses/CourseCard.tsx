import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, DAYS_SHORT, radius } from '../../theme';
import type { Course } from '../../types';

interface Props {
  course: Course;
  onEdit: () => void;
  onDelete: () => void;
}

export default function CourseCard({ course, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  // "Emin misin?" durumu birkaç saniye sonra kendiliğinden geri döner
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: course.color }]} />
      <View style={styles.content}>
        <Text style={[styles.code, { color: course.color }]}>{course.code}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {course.name}
        </Text>
        {course.instructor ? <Text style={styles.meta}>{course.instructor}</Text> : null}
        <Text style={styles.meta}>
          {course.credits} AKTS{course.semester ? ` · ${course.semester}` : ''}
        </Text>

        <View style={styles.sessions}>
          {course.sessions.length === 0 ? (
            <Text style={styles.noSession}>Ders saati eklenmedi</Text>
          ) : (
            course.sessions.map((s) => (
              <Text key={s.id} style={styles.session}>
                {DAYS_SHORT[s.day]} {s.start}–{s.end}
                {s.room ? ` · ${s.room}` : ''}
              </Text>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onEdit} style={styles.actionBtn}>
            <Text style={styles.editText}>Düzenle</Text>
          </Pressable>
          <Pressable
            onPress={() => (confirming ? onDelete() : setConfirming(true))}
            style={[styles.actionBtn, confirming && styles.deleteConfirm]}
          >
            <Text style={[styles.deleteText, confirming && { color: '#FFFFFF' }]}>
              {confirming ? 'Emin misin?' : 'Sil'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stripe: { width: 6 },
  content: { flex: 1, padding: 16 },
  code: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6, marginBottom: 6 },
  meta: { fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  sessions: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 3,
  },
  session: { fontSize: 13, color: colors.text },
  noSession: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  editText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  deleteText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  deleteConfirm: { backgroundColor: colors.danger },
});
