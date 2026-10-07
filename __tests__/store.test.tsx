import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { DEFAULT_REMINDERS, StoreProvider, uid, useStore } from '../src/store';
import { makeCourse, makeData, makeTask, readStorage, seedStorage, STORAGE_KEY } from './helpers';

async function renderStore() {
  const hook = await renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

const { courseId: _omitCourseId, ...taskInput } = makeTask();
const { id: _omitId, createdAt: _omitCreated, ...courseInput } = makeCourse();

describe('uid', () => {
  it('benzersiz kimlikler üretir', () => {
    const ids = new Set(Array.from({ length: 500 }, uid));
    expect(ids.size).toBe(500);
  });
});

describe('useStore', () => {
  it('StoreProvider dışında kullanılırsa hata fırlatır', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useStore())).rejects.toThrow('StoreProvider içinde kullanılmalı');
    spy.mockRestore();
  });
});

describe('yükleme', () => {
  it('depo boşsa varsayılan veriyle başlar', async () => {
    const { result } = await renderStore();
    expect(result.current.data).toEqual(makeData());
  });

  it('kayıtlı veriyi yükler', async () => {
    const course = makeCourse({ reminders: [60, 30] });
    await seedStorage(makeData({ courses: [course], settings: { notifications: false } }));
    const { result } = await renderStore();
    expect(result.current.data.courses).toEqual([course]);
    expect(result.current.data.settings.notifications).toBe(false);
  });

  it('eski tekli hatırlatma alanını listeye çevirir', async () => {
    const { reminders: _r, ...base } = makeCourse();
    const missing = { ...base, code: 'EKSIK' };
    const single = { ...base, code: 'TEK', reminder: 30 };
    const off = { ...base, code: 'KAPALI', reminder: null };
    await seedStorage({ version: 1, courses: [missing, single, off], tasks: [] });
    const { result } = await renderStore();

    const [a, b, c] = result.current.data.courses;
    expect(DEFAULT_REMINDERS).toEqual([15]);
    expect(a.reminders).toEqual([15]);
    expect(b.reminders).toEqual([30]);
    expect(c.reminders).toEqual([]);
    for (const course of [a, b, c]) expect(course).not.toHaveProperty('reminder');
    expect(result.current.data.settings).toEqual({ notifications: true });
  });

  it('kayıtlı hatırlatma listesini tekrarsız ve büyükten küçüğe düzenler', async () => {
    const messy = makeCourse({ reminders: [10, 60, 10, 0, 120] });
    await seedStorage(makeData({ courses: [messy] }));
    const { result } = await renderStore();
    expect(result.current.data.courses[0].reminders).toEqual([120, 60, 10]);
  });

  it('eski kayıtlardaki kaldırılmış durum alanını atar, bırakılmış dersleri de korur', async () => {
    const done = { ...makeCourse({ code: 'BITTI' }), status: 'completed' };
    const dropped = { ...makeCourse({ code: 'BIRAKTI' }), status: 'dropped' };
    await seedStorage({ version: 1, courses: [done, dropped], tasks: [] });
    const { result } = await renderStore();

    expect(result.current.data.courses.map((c) => c.code)).toEqual(['BITTI', 'BIRAKTI']);
    result.current.data.courses.forEach((c) => expect(c).not.toHaveProperty('status'));
  });

  it('eksik dizileri boş diziyle tamamlar', async () => {
    await seedStorage({ version: 1 });
    const { result } = await renderStore();
    expect(result.current.data.courses).toEqual([]);
    expect(result.current.data.tasks).toEqual([]);
  });

  it('bozuk JSON çökmeye yol açmaz', async () => {
    await seedStorage('{bozuk');
    const { result } = await renderStore();
    expect(result.current.data).toEqual(makeData());
  });

  it('yükleme bitmeden depoya yazmaz', async () => {
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise(() => {}));
    const { result } = await renderHook(() => useStore(), { wrapper: StoreProvider });
    expect(result.current.loaded).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('dersler', () => {
  it('addCourse kimlik ve zaman damgası ekler, kalıcı olarak kaydeder', async () => {
    const { result } = await renderStore();
    let created!: ReturnType<typeof result.current.addCourse>;
    await act(async () => {
      created = result.current.addCourse(courseInput);
    });

    expect(created.id).toEqual(expect.any(String));
    expect(created.createdAt).toEqual(expect.any(Number));
    expect(result.current.data.courses).toEqual([created]);
    await waitFor(async () => expect((await readStorage())?.courses).toEqual([created]));
  });

  it('updateCourse yalnızca hedef dersi günceller', async () => {
    const a = makeCourse({ code: 'A' });
    const b = makeCourse({ code: 'B' });
    await seedStorage(makeData({ courses: [a, b] }));
    const { result } = await renderStore();

    await act(async () => result.current.updateCourse(a.id, { name: 'Yeni ad', letterGrade: 'AA' }));
    expect(result.current.data.courses).toEqual([{ ...a, name: 'Yeni ad', letterGrade: 'AA' }, b]);
  });

  it('deleteCourse dersi siler ve bağlı görevlerin ders bağlantısını kaldırır', async () => {
    const a = makeCourse();
    const b = makeCourse();
    const ta = makeTask({ courseId: a.id });
    const tb = makeTask({ courseId: b.id });
    await seedStorage(makeData({ courses: [a, b], tasks: [ta, tb] }));
    const { result } = await renderStore();

    await act(async () => result.current.deleteCourse(a.id));
    expect(result.current.data.courses).toEqual([b]);
    expect(result.current.data.tasks).toEqual([{ ...ta, courseId: null }, tb]);
  });
});

describe('görevler ve ayarlar', () => {
  it('addTask / updateTask / deleteTask', async () => {
    const { result } = await renderStore();
    let task!: ReturnType<typeof result.current.addTask>;
    await act(async () => {
      task = result.current.addTask({ ...taskInput, courseId: null });
    });
    expect(result.current.data.tasks).toEqual([task]);

    await act(async () => result.current.updateTask(task.id, { done: true }));
    expect(result.current.data.tasks[0].done).toBe(true);

    await act(async () => result.current.deleteTask(task.id));
    expect(result.current.data.tasks).toEqual([]);
  });

  it('updateSettings ayarları birleştirir ve kaydeder', async () => {
    const { result } = await renderStore();
    await act(async () => result.current.updateSettings({ notifications: false }));
    expect(result.current.data.settings).toEqual({ notifications: false });
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!).settings.notifications).toBe(false),
    );
  });
});
