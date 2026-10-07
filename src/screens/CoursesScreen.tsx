import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CourseCard from '../components/courses/CourseCard';
import CourseForm, { type CourseInput } from '../components/courses/CourseForm';
import { useStore } from '../store';
import { colors, radius } from '../theme';
import type { Course } from '../types';

export default function CoursesScreen() {
  const { data, addCourse, updateCourse, deleteCourse } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [formKey, setFormKey] = useState(0);

  const openForm = (course: Course | null) => {
    setEditing(course);
    setFormKey((k) => k + 1); // formu her açılışta temiz başlat
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = (value: CourseInput) => {
    if (editing) updateCourse(editing.id, value);
    else addCourse(value);
    closeForm();
  };

  const courses = [...data.courses].sort((a, b) => a.code.localeCompare(b.code, 'tr'));
  const totalCredits = data.courses.reduce((s, c) => s + c.credits, 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Dersler</Text>
            <Text style={styles.subtitle}>
              {data.courses.length} ders · {totalCredits} AKTS
            </Text>
          </View>
          <Pressable onPress={() => openForm(null)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Ders Ekle</Text>
          </Pressable>
        </View>

        {courses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Henüz ders yok</Text>
            <Text style={styles.emptyText}>
              Derslerini ve haftalık ders saatlerini ekle, ana sayfadaki programda görünsün.
            </Text>
            <Pressable onPress={() => openForm(null)} style={[styles.addBtn, { marginTop: 16 }]}>
              <Text style={styles.addBtnText}>+ Ders Ekle</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                onEdit={() => openForm(c)}
                onDelete={() => deleteCourse(c.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {formOpen && (
        <CourseForm
          key={formKey}
          visible={formOpen}
          initial={editing}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  grid: { gap: 12 },
  empty: {
    alignItems: 'center',
    paddingVertical: 64,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center', maxWidth: 380 },
});
