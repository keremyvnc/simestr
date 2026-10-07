import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import CoursesScreen from '../src/screens/CoursesScreen';
import { makeCourse, makeData, readStorage, renderWithStore } from './helpers';

const codesOnScreen = () => screen.getAllByText(/^[A-Z]{3}\d{3}$/).map((el) => el.props.children);

function seed() {
  return makeData({
    courses: [
      makeCourse({ code: 'BIL502', name: 'Veri Yapıları', credits: 7.5 }),
      makeCourse({ code: 'ALG101', name: 'Algoritmalar', credits: 5 }),
      makeCourse({ code: 'MAT101', name: 'Analiz', credits: 6 }),
    ],
  });
}

describe('CoursesScreen', () => {
  it('ders yoksa boş durum gösterir', async () => {
    await renderWithStore(<CoursesScreen />);
    expect(screen.getByText('Henüz ders yok')).toBeOnTheScreen();
    expect(screen.getByText('0 ders · 0 AKTS')).toBeOnTheScreen();
  });

  it('özet ve kod sırasına göre tüm dersleri listeler', async () => {
    await renderWithStore(<CoursesScreen />, seed());

    expect(screen.getByText('3 ders · 18.5 AKTS')).toBeOnTheScreen();
    expect(codesOnScreen()).toEqual(['ALG101', 'BIL502', 'MAT101']);
    expect(screen.queryByText(/Tamamlan|Bırakıl|Tümü/)).not.toBeOnTheScreen();
  });

  it('form üzerinden yeni ders ekler ve kaydeder', async () => {
    await renderWithStore(<CoursesScreen />);

    await fireEvent.press(screen.getAllByText('+ Ders Ekle')[0]);
    expect(screen.getByText('Yeni Ders')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('ör. BIL501'), 'fiz101');
    await fireEvent.changeText(screen.getByPlaceholderText('ör. İleri Algoritma Analizi'), 'Fizik');
    await fireEvent.press(screen.getByText('Dersi Ekle'));

    expect(screen.queryByText('Yeni Ders')).not.toBeOnTheScreen();
    expect(screen.getByText('FIZ101')).toBeOnTheScreen();
    expect(screen.getByText('1 ders · 7.5 AKTS')).toBeOnTheScreen();
    await waitFor(async () => expect((await readStorage())?.courses.map((c) => c.code)).toEqual(['FIZ101']));
  });

  it('Vazgeç formu değişiklik yapmadan kapatır', async () => {
    await renderWithStore(<CoursesScreen />, seed());
    await fireEvent.press(screen.getByText('+ Ders Ekle'));
    await fireEvent.press(screen.getByText('Vazgeç'));
    expect(screen.queryByText('Yeni Ders')).not.toBeOnTheScreen();
    expect(codesOnScreen()).toHaveLength(3);
  });

  it('mevcut dersi düzenler', async () => {
    await renderWithStore(<CoursesScreen />, seed());

    await fireEvent.press(screen.getAllByText('Düzenle')[0]); // ALG101
    expect(screen.getByText('Dersi Düzenle')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByDisplayValue('Algoritmalar'), 'Algoritmalar II');
    await fireEvent.press(screen.getByText('Kaydet'));

    expect(screen.getByText('Algoritmalar II')).toBeOnTheScreen();
    expect(codesOnScreen()).toHaveLength(3);
  });

  it('onaydan sonra dersi siler', async () => {
    await renderWithStore(<CoursesScreen />, seed());

    await fireEvent.press(screen.getAllByText('Sil')[0]); // ALG101
    await fireEvent.press(screen.getByText('Emin misin?'));

    expect(codesOnScreen()).toEqual(['BIL502', 'MAT101']);
    expect(screen.getByText('2 ders · 13.5 AKTS')).toBeOnTheScreen();
    await waitFor(async () => expect((await readStorage())?.courses).toHaveLength(2));
  });
});
