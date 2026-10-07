import { createElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, radius } from '../theme';

// "HH:MM" ↔ Date dönüşümleri (yalnızca saat/dakika kullanılır)
const toDate = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  const d = new Date();
  d.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0);
  return d;
};

const fromDate = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Web'de doğrudan DOM <input> stili (react-native-web üzerinden)
const webInputStyle = {
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: colors.border,
  borderRadius: radius.sm,
  padding: '8px 6px 8px 10px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: colors.text,
  backgroundColor: '#FFFFFF',
  width: '100%',
  boxSizing: 'border-box',
};

interface Props {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  error?: boolean;
  active?: boolean; // iOS: tekerlek bu alan için açık mı
  onPress?: () => void; // iOS: tekerleği aç/kapat
}

/**
 * Saat seçimi için dokunulabilir alan.
 * - Android: dokununca yerel saat penceresi açılır.
 * - iOS: onPress ile üst bileşen satırın altında <TimeWheel> gösterir (iç içe Modal yok).
 * - Web: tarayıcının <input type="time"> alanı kullanılır.
 */
export default function TimeField({ value, onChange, error, active, onPress }: Props) {
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'time',
      step: 300,
      value,
      onChange: (e: { target: { value: string } }) => {
        if (e.target.value) onChange(e.target.value);
      },
      style: { ...webInputStyle, ...(error ? { borderColor: colors.danger } : null) },
    });
  }

  const handlePress = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'time',
        is24Hour: true,
        onValueChange: (_e, date) => onChange(fromDate(date)),
      });
    } else {
      onPress?.();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.pill, error && styles.pillError, active && styles.pillActive]}
    >
      <Text style={[styles.text, active && { color: colors.primary }]}>{value}</Text>
      <Ionicons name="time-outline" size={15} color={active ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

/** iOS'ta satırın altında açılan Apple tarzı saat tekerleği. Diğer platformlarda hiçbir şey çizmez. */
export function TimeWheel({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  if (Platform.OS !== 'ios') return null;
  return (
    <View style={styles.wheelBox}>
      <DateTimePicker
        value={toDate(value)}
        mode="time"
        display="spinner"
        locale="tr-TR"
        is24Hour
        minuteInterval={5}
        themeVariant="light"
        textColor={colors.text}
        onValueChange={(_e, date) => onChange(fromDate(date))}
        style={styles.wheel}
      />
      <Pressable onPress={onDone} style={styles.doneBtn} hitSlop={8}>
        <Text style={styles.doneText}>Tamam</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  pillError: { borderColor: colors.danger },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  text: { fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  wheelBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    overflow: 'hidden',
  },
  wheel: { height: 180 },
  doneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  doneText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
