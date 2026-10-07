import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage: paketin kendi bellek içi mock'u
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-notifications: yerel modül yok, tüm çağrılar jest.fn
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
}));

// Saat seçici: yerel bileşen yerine testID'li bir View; testler fireEvent(el, 'valueChange', e, date) kullanır
jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  const DateTimePicker = (props: object) => createElement(View, { ...props, testID: 'time-picker' });
  return {
    __esModule: true,
    default: DateTimePicker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

// İkonlar: font yükleyicisini (expo-font/expo-asset) devre dışı bırakır
jest.mock('@expo/vector-icons/Ionicons', () => {
  const Ionicons = () => null;
  Ionicons.glyphMap = {};
  return { __esModule: true, default: Ionicons };
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
