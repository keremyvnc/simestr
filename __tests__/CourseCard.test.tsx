import { act, fireEvent, render, screen } from '@testing-library/react-native';
import CourseCard from '../src/components/courses/CourseCard';
import { makeCourse, makeSession } from './helpers';

function setup(overrides: Parameters<typeof makeCourse>[0] = {}) {
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  const course = makeCourse(overrides);
  return { course, onEdit, onDelete, ui: <CourseCard course={course} onEdit={onEdit} onDelete={onDelete} /> };
}

describe('CourseCard', () => {
  it('ders bilgilerini ve oturumları gösterir', async () => {
    const { ui } = setup({
      code: 'BIL501',
      name: 'Algoritmalar',
      instructor: 'Prof. Dr. Ayşe Yılmaz',
      credits: 7.5,
      semester: '2026-2027 Güz',
      sessions: [makeSession({ day: 0, start: '09:00', end: '11:50', room: 'B-204' }), makeSession({ day: 3, start: '13:00', end: '14:50' })],
    });
    await render(ui);

    expect(screen.getByText('BIL501')).toBeOnTheScreen();
    expect(screen.getByText('Algoritmalar')).toBeOnTheScreen();
    expect(screen.getByText('Prof. Dr. Ayşe Yılmaz')).toBeOnTheScreen();
    expect(screen.getByText('7.5 AKTS · 2026-2027 Güz')).toBeOnTheScreen();
    expect(screen.getByText('Pzt 09:00–11:50 · B-204')).toBeOnTheScreen();
    expect(screen.getByText('Per 13:00–14:50')).toBeOnTheScreen();
  });

  it('oturum yoksa ve dönem boşsa uygun metni gösterir', async () => {
    await render(setup({ sessions: [], semester: '', instructor: '' }).ui);
    expect(screen.getByText('Ders saati eklenmedi')).toBeOnTheScreen();
    expect(screen.getByText('7.5 AKTS')).toBeOnTheScreen();
  });

  it('Düzenle butonu onEdit çağırır', async () => {
    const { ui, onEdit } = setup();
    await render(ui);
    await fireEvent.press(screen.getByText('Düzenle'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('silme iki aşamalı onay ister', async () => {
    const { ui, onDelete } = setup();
    await render(ui);

    await fireEvent.press(screen.getByText('Sil'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Emin misin?')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Emin misin?'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('onay 3 saniye sonra kendiliğinden geri döner', async () => {
    jest.useFakeTimers();
    try {
      const { ui, onDelete } = setup();
      await render(ui);
      await fireEvent.press(screen.getByText('Sil'));

      await act(async () => {
        jest.advanceTimersByTime(2999);
      });
      expect(screen.getByText('Emin misin?')).toBeOnTheScreen();

      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.getByText('Sil')).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('Sil'));
      expect(onDelete).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
