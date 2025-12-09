import '@testing-library/jest-native/extend-expect';

global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  })),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn((callback) => {
    callback();
  }),
  Stack: {
    Screen: ({ children }) => children,
  },
  Tabs: {
    Screen: ({ children }) => children,
  },
  Slot: 'Slot',
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn(() => jest.fn()),
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [
    { granted: true },
    jest.fn(),
  ],
}));
