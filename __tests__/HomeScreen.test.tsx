import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import HomeScreen from '../src/screens/HomeScreen';
import type { AppData } from '../src/types';
import { makeCourse, makeData, makeSession, readStorage, renderWithStore } from './helpers';

// 7 Ekim 2026 Çarşamba, 10:00 — hafta: 5–11 Ekim
const NOW = new Date(2026, 9, 7, 10, 0);
const WED = 2;

const codesOnScreen = () => screen.queryAllByText(/^[A-Z]{3}\d{3}$/).map((el) => el.props.children);

async function setup(data?: AppData, now = NOW) {
  jest.useFakeTimers({ now });
  const onNavigate = jest.fn();
  await renderWithStore(<HomeScreen onNavigate={onNavigate} />, data);
  return { onNavigate };
}

function weekData() {
  return makeData({
    courses: [
      makeCourse({
        code: 'BIL502',
        name: 'Veri Yapıları',
        sessions: [makeSession({ day: WED, start: '13:00', end: '13:50', room: 'B-204' })],
      }),
      makeCourse({
        code: 'ALG101',
        name: 'Algoritmalar',
        instructor: 'Dr. Ali',
        reminders: [10, 60],
        sessions: [makeSession({ day: WED, start: '09:00', end: '11:50' }), makeSession({ day: 4, start: '10:00', end: '12:00' })],
      }),
      makeCourse({ code: 'HAT101', sessions: [makeSession({ day: WED, start: '15:00', end: '14:00' })] }),
    ],
  });
}

afterEach(() => jest.useRealTimers());

describe('HomeScreen — başlık', () => {
  it('haftanın tarih aralığını ve ders sayısını gösterir', async () => {
    await setup(weekData());
    expect(screen.getByText('5 – 11 Ekim 2026 · 2 ders')).toBeOnTheScreen();
    // Bu hafta gösterildiği için "Bugün" kısayolu yok
    expect(screen.queryByText('Bugün')).not.toBeOnTheScreen();
  });

  it('ay değişen haftada iki ayı da yazar', async () => {
    await setup(weekData(), new Date(2026, 8, 30, 10, 0)); // 30 Eylül Çarşamba
    expect(screen.getByText('28 Eylül – 4 Ekim · 2 ders')).toBeOnTheScreen();
  });

  it('başka haftaya geçince Bugün kısayolu çıkar ve geri döndürür', async () => {
    await setup(weekData());
    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    expect(screen.getByText('12 – 18 Ekim 2026 · 2 ders')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Bugün'));
    expect(screen.getByText('5 – 11 Ekim 2026 · 2 ders')).toBeOnTheScreen();
    expect(screen.queryByText('Bugün')).not.toBeOnTheScreen();
  });
});

describe('HomeScreen — haftalık tablo', () => {
  it('yalnızca dolu saat aralıklarını başlangıç ve bitişiyle, sırayla gösterir', async () => {
    await setup(weekData());
    const times = screen.getAllByText(/^\d{2}:\d{2}$/).map((el) => el.props.children);
    // 09:00–11:50 (Çar) ve 10:00–12:00 (Cum) çakıştığı için 09:00–12:00 bandında birleşir
    expect(times).toEqual(['09:00', '12:00', '13:00', '13:50']);
    // Kartlarda kendi saatleri yazar; şu an süren Çarşamba dersinde saat yerine "Şimdi" görünür
    expect(screen.getByText('10:00–12:00')).toBeOnTheScreen();
    expect(screen.getAllByText('Şimdi')).toHaveLength(1);
    // Geçersiz (bitişi başlangıçtan önce) oturum gösterilmez
    expect(screen.queryByText('HAT101')).not.toBeOnTheScreen();
  });

  it('başka bir dersin içinde kalan ders aynı bantta, kendi saatiyle görünür', async () => {
    const data = makeData({
      courses: [
        makeCourse({ code: 'BIL502', name: 'Veri Yapıları', sessions: [makeSession({ day: 0, start: '19:45', end: '21:50' })] }),
        makeCourse({ code: 'ALG101', name: 'Algoritmalar', sessions: [makeSession({ day: 1, start: '19:45', end: '21:50' })] }),
        makeCourse({ code: 'MAT101', name: 'Analiz', sessions: [makeSession({ day: 2, start: '19:55', end: '20:30', room: 'A-1' })] }),
      ],
    });
    await setup(data);
    const times = screen.getAllByText(/^\d{2}:\d{2}$/).map((el) => el.props.children);
    expect(times).toEqual(['19:45', '21:50']);
    expect(codesOnScreen()).toEqual(['BIL502', 'ALG101', 'MAT101']);
    // Bantla aynı saatteki derslerde saat tekrar yazılmaz, farklı olanda yazılır
    expect(screen.getByText('19:55–20:30 · A-1')).toBeOnTheScreen();
    expect(screen.queryByText('19:45–21:50')).not.toBeOnTheScreen();
  });

  it('bitişi diğerinin başlangıcına denk gelen dersler ayrı satırlarda kalır', async () => {
    const data = makeData({
      courses: [
        makeCourse({ code: 'BIL502', sessions: [makeSession({ day: 0, start: '09:00', end: '10:00' })] }),
        makeCourse({ code: 'ALG101', sessions: [makeSession({ day: 1, start: '10:00', end: '11:00' })] }),
      ],
    });
    await setup(data);
    const times = screen.getAllByText(/^\d{2}:\d{2}$/).map((el) => el.props.children);
    expect(times).toEqual(['09:00', '10:00', '10:00', '11:00']);
  });

  it('saatler her zaman tek satırda kalır', async () => {
    await setup(weekData());
    screen.getAllByText(/^\d{2}:\d{2}$/).forEach((el) => expect(el.props.numberOfLines).toBe(1));
  });

  it('dersleri ilgili gün sütununda gösterir; aynı ders farklı günlerde tekrar eder', async () => {
    await setup(weekData());
    expect(codesOnScreen()).toEqual(['ALG101', 'ALG101', 'BIL502']);
  });

  it('hafta içi günleri her zaman, hafta sonunu yalnızca ders varsa gösterir', async () => {
    await setup(weekData());
    ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA'].forEach((d) => expect(screen.getByText(d)).toBeOnTheScreen());
    expect(screen.queryByText('CUMARTESİ')).not.toBeOnTheScreen();
    expect(screen.queryByText('PAZAR')).not.toBeOnTheScreen();
  });

  it('hafta sonu dersi varsa o günün sütununu ekler', async () => {
    const data = weekData();
    data.courses.push(makeCourse({ code: 'SEM600', sessions: [makeSession({ day: 5, start: '10:00', end: '12:00' })] }));
    await setup(data);
    expect(screen.getByText('CUMARTESİ')).toBeOnTheScreen();
    expect(screen.queryByText('PAZAR')).not.toBeOnTheScreen();
    expect(screen.getByText('SEM600')).toBeOnTheScreen();
  });

  it('aynı gün ve saatteki iki dersi aynı hücrede birlikte gösterir', async () => {
    const data = makeData({
      courses: [
        makeCourse({ code: 'BIL502', name: 'Veri Yapıları', sessions: [makeSession({ day: 0, start: '13:40', end: '16:30' })] }),
        makeCourse({ code: 'ALG101', name: 'Algoritmalar', sessions: [makeSession({ day: 0, start: '13:40', end: '16:30' })] }),
      ],
    });
    await setup(data);
    expect(screen.getAllByText('13:40')).toHaveLength(1);
    expect(codesOnScreen()).toEqual(['ALG101', 'BIL502']);
  });

  it('devam eden dersi "Şimdi" ile işaretler', async () => {
    await setup(weekData());
    expect(screen.getAllByText('Şimdi')).toHaveLength(1);
  });

  it('saat ilerledikçe "Şimdi" işareti güncellenir', async () => {
    await setup(weekData());
    // 12:00 — ALG101 bitti, BIL502 henüz başlamadı
    await act(() => jest.advanceTimersByTimeAsync(2 * 60 * 60_000));
    expect(screen.queryByText('Şimdi')).not.toBeOnTheScreen();
    // 13:10 — BIL502 sürüyor
    await act(() => jest.advanceTimersByTimeAsync(70 * 60_000));
    expect(screen.getAllByText('Şimdi')).toHaveLength(1);
  });

  it('başka haftada "Şimdi" işareti gösterilmez', async () => {
    await setup(weekData());
    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    expect(screen.queryByText('Şimdi')).not.toBeOnTheScreen();
  });

  it('hiç ders yoksa derslere yönlendirir', async () => {
    const { onNavigate } = await setup();
    expect(screen.getByText('Henüz ders eklemedin')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Ders ekle'));
    expect(onNavigate).toHaveBeenCalledWith('courses');
  });

  it('derse dokununca ayrıntıları gösterir', async () => {
    await setup(weekData());
    await fireEvent.press(screen.getAllByText('Algoritmalar')[0]); // Çarşamba 09:00

    expect(screen.getByText('Çarşamba, 09:00–11:50')).toBeOnTheScreen();
    expect(screen.getByText('Derslik belirtilmedi')).toBeOnTheScreen();
    expect(screen.getAllByText('Dr. Ali').length).toBeGreaterThan(0);
    expect(screen.getByText('Hatırlatma: 1 sa, 10 dk önce')).toBeOnTheScreen();
    expect(screen.getAllByText('7.5 AKTS · 2026-2027 Güz').length).toBe(1);
  });
});

describe('HomeScreen — hatırlatma anahtarı', () => {
  it('açıkken basınca kapatır ve kaydeder', async () => {
    await setup(weekData());
    await fireEvent.press(screen.getByLabelText('Hatırlatmaları kapat'));

    expect(screen.getByLabelText('Hatırlatmaları aç')).toBeOnTheScreen();
    await act(() => jest.runOnlyPendingTimersAsync());
    expect((await readStorage())?.settings.notifications).toBe(false);
  });

  it('kapalıyken izin verilirse açar', async () => {
    await setup({ ...weekData(), settings: { notifications: false } });
    await fireEvent.press(screen.getByLabelText('Hatırlatmaları aç'));
    expect(screen.getByLabelText('Hatırlatmaları kapat')).toBeOnTheScreen();
  });

  it('izin reddedilirse uyarı gösterir ve kapalı bırakır', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);

    await setup({ ...weekData(), settings: { notifications: false } });
    await fireEvent.press(screen.getByLabelText('Hatırlatmaları aç'));

    expect(alert).toHaveBeenCalledWith('Bildirim izni yok', expect.any(String));
    expect(screen.getByLabelText('Hatırlatmaları aç')).toBeOnTheScreen();
    alert.mockRestore();
  });
});
