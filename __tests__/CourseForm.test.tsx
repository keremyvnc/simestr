import { fireEvent, render, screen } from '@testing-library/react-native';
import CourseForm, { type CourseInput } from '../src/components/courses/CourseForm';
import type { Course } from '../src/types';
import { makeCourse, makeSession, Providers } from './helpers';

async function setup(initial: Course | null = null) {
  const onSubmit = jest.fn<void, [CourseInput]>();
  const onCancel = jest.fn();
  await render(
    <Providers>
      <CourseForm visible initial={initial} onSubmit={onSubmit} onCancel={onCancel} />
    </Providers>,
  );
  return { onSubmit, onCancel, submitted: () => onSubmit.mock.calls[0][0] };
}

const type = (placeholder: string, text: string) =>
  fireEvent.changeText(screen.getByPlaceholderText(placeholder), text);

async function fillRequired(code = 'bil501', name = 'Algoritmalar') {
  await type('ör. BIL501', code);
  await type('ör. İleri Algoritma Analizi', name);
}

// TimeField'a basıp açılan saat tekerleğinden yeni değer seçer
async function pickTime(current: string, next: string, index = 0) {
  await fireEvent.press(screen.getAllByText(current)[index]);
  const [h, m] = next.split(':').map(Number);
  const date = new Date(2026, 0, 1, h, m);
  await fireEvent(screen.getByTestId('time-picker'), 'valueChange', { type: 'set' }, date);
  await fireEvent.press(screen.getByText('Tamam'));
}

describe('CourseForm — doğrulama', () => {
  it('zorunlu alanlar boşken kaydetmez ve hataları gösterir', async () => {
    const { onSubmit } = await setup();
    await fireEvent.press(screen.getByText('Dersi Ekle'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Ders kodu zorunlu.')).toBeOnTheScreen();
    expect(screen.getByText('Ders adı zorunlu.')).toBeOnTheScreen();
    expect(screen.getByText('Lütfen işaretli alanları düzeltin.')).toBeOnTheScreen();
  });

  it('yalnızca boşluktan oluşan değerleri boş sayar', async () => {
    const { onSubmit } = await setup();
    await fillRequired('   ', '  ');
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Ders kodu zorunlu.')).toBeOnTheScreen();
  });

  it.each(['0', '-2', 'abc', ''])('geçersiz AKTS (%p) reddedilir', async (credits) => {
    const { onSubmit } = await setup();
    await fillRequired();
    await fireEvent.changeText(screen.getByDisplayValue('7.5'), credits);
    await fireEvent.press(screen.getByText('Dersi Ekle'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Geçerli bir AKTS girin (ör. 7.5).')).toBeOnTheScreen();
  });

  it('hatalar düzeltilince kaydeder', async () => {
    const { onSubmit } = await setup();
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    await fillRequired();
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('CourseForm — yeni ders', () => {
  it('başlık ve varsayılanlar', async () => {
    const { submitted } = await setup();
    expect(screen.getByText('Yeni Ders')).toBeOnTheScreen();
    expect(screen.getByText('Haftalık programda görünmesi için en az bir ders saati ekleyin.')).toBeOnTheScreen();

    await fillRequired();
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(submitted()).toEqual({
      code: 'BIL501',
      name: 'Algoritmalar',
      instructor: '',
      credits: 7.5,
      semester: '2026-2027 Güz',
      color: '#4F46E5',
      notes: '',
      reminders: [15],
      sessions: [],
      letterGrade: null,
      assessments: [],
    });
  });

  it('metinleri kırpar, kodu büyük harfe çevirir, virgüllü AKTS kabul eder', async () => {
    const { submitted } = await setup();
    await fillRequired('  bil502 ', '  Veri Yapıları  ');
    await type('ör. Prof. Dr. Ayşe Yılmaz', '  Dr. Ali  ');
    await type('Ders hakkında notlar…', '  not  ');
    await fireEvent.changeText(screen.getByDisplayValue('7.5'), '6,5');
    await fireEvent.press(screen.getByText('Dersi Ekle'));

    expect(submitted()).toMatchObject({
      code: 'BIL502',
      name: 'Veri Yapıları',
      instructor: 'Dr. Ali',
      notes: 'not',
      credits: 6.5,
    });
  });

  it('hatırlatmayı kapatabilir', async () => {
    const { submitted } = await setup();
    await fillRequired();
    await fireEvent.press(screen.getByText('Kapalı'));
    expect(screen.getByText('Hatırlatma yok')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(submitted().reminders).toEqual([]);
  });

  it('birden fazla hatırlatma seçilebilir; tekrar basmak seçimi kaldırır', async () => {
    const { submitted } = await setup();
    await fillRequired();
    const chip = (label: string) => screen.getByRole('checkbox', { name: label });
    expect(chip('15 dk')).toBeChecked();
    expect(chip('Kapalı')).not.toBeChecked();

    await fireEvent.press(chip('10 dk'));
    await fireEvent.press(chip('2 sa'));
    await fireEvent.press(chip('1 gün'));
    await fireEvent.press(chip('15 dk')); // kaldır
    expect(chip('15 dk')).not.toBeChecked();
    expect(chip('2 sa')).toBeChecked();
    expect(screen.getByText('Hatırlatma: 1 gün, 2 sa, 10 dk önce')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(submitted().reminders).toEqual([1440, 120, 10]);
  });

  it('tüm seçimler kaldırılınca Kapalı aktif olur', async () => {
    const { submitted } = await setup();
    await fillRequired();
    await fireEvent.press(screen.getByRole('checkbox', { name: '15 dk' }));
    expect(screen.getByRole('checkbox', { name: 'Kapalı' })).toBeChecked();
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(submitted().reminders).toEqual([]);
  });

  it('Vazgeç onCancel çağırır', async () => {
    const { onCancel, onSubmit } = await setup();
    await fireEvent.press(screen.getByText('Vazgeç'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('CourseForm — ders saatleri', () => {
  it('saat ekler, derslik adını kırpar ve kaldırabilir', async () => {
    const { submitted, onSubmit } = await setup();
    await fillRequired();

    await fireEvent.press(screen.getByText('+ Saat ekle'));
    expect(screen.getByText('09:00')).toBeOnTheScreen();
    expect(screen.getByText('11:50')).toBeOnTheScreen();
    await type('ör. B-204', '  B-204 ');
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(submitted().sessions).toEqual([
      { id: expect.any(String), day: 0, start: '09:00', end: '11:50', room: 'B-204' },
    ]);

    await fireEvent.press(screen.getByText('Kaldır'));
    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(onSubmit.mock.calls[1][0].sessions).toEqual([]);
  });

  it('oturumları gün ve saate göre sıralar', async () => {
    const { submitted } = await setup();
    await fillRequired();
    // Üç oturum: ilki Cuma 09:00, ikincisi Pazartesi 13:00, üçüncüsü Pazartesi 09:00
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByText('+ Saat ekle'));
    await fireEvent.press(screen.getAllByText('Cum')[0]);
    await pickTime('09:00', '13:00', 1);

    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(submitted().sessions.map((s) => [s.day, s.start])).toEqual([
      [0, '09:00'],
      [0, '13:00'],
      [4, '09:00'],
    ]);
  });

  it('başlangıç bitişi geçerse süreyi koruyarak bitişi kaydırır', async () => {
    const { submitted } = await setup();
    await fillRequired();
    await fireEvent.press(screen.getByText('+ Saat ekle'));
    await pickTime('09:00', '12:00'); // süre 2 sa 50 dk → 14:50
    expect(screen.getByText('14:50')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Dersi Ekle'));
    expect(submitted().sessions[0]).toMatchObject({ start: '12:00', end: '14:50' });
  });

  it('kaydırılan bitiş 23:55’i geçmez', async () => {
    await setup();
    await fillRequired();
    await fireEvent.press(screen.getByText('+ Saat ekle'));
    await pickTime('09:00', '23:00');
    expect(screen.getByText('23:55')).toBeOnTheScreen();
  });

  it('başlangıç bitişten önce kalırsa bitişe dokunmaz', async () => {
    await setup();
    await fillRequired();
    await fireEvent.press(screen.getByText('+ Saat ekle'));
    await pickTime('09:00', '10:00');
    expect(screen.getByText('11:50')).toBeOnTheScreen();
  });

  it('bitiş başlangıçtan önceyse hata verir', async () => {
    const { onSubmit } = await setup();
    await fillRequired();
    await fireEvent.press(screen.getByText('+ Saat ekle'));
    await pickTime('11:50', '08:00');
    await fireEvent.press(screen.getByText('Dersi Ekle'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Bitiş saati başlangıçtan sonra olmalı.')).toBeOnTheScreen();
  });
});

describe('CourseForm — düzenleme', () => {
  it('mevcut değerleri doldurur ve form dışı alanları korur', async () => {
    const initial = makeCourse({
      code: 'MAT101',
      name: 'Analiz',
      credits: 5,
      letterGrade: 'BA',
      assessments: [{ id: 'a1', name: 'Vize', weight: 40, score: 80 }],
      reminders: [60, 5],
      sessions: [makeSession({ day: 2, start: '10:00', end: '11:00', room: 'A-1' })],
    });
    const { submitted } = await setup(initial);

    expect(screen.getByText('Dersi Düzenle')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('MAT101')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('5')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('A-1')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: '1 sa' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '5 dk' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '15 dk' })).not.toBeChecked();

    await fireEvent.changeText(screen.getByDisplayValue('Analiz'), 'Analiz I');
    await fireEvent.press(screen.getByText('Kaydet'));

    expect(submitted()).toMatchObject({
      name: 'Analiz I',
      letterGrade: 'BA',
      assessments: initial.assessments,
      reminders: [60, 5],
      sessions: initial.sessions,
    });
  });
});
