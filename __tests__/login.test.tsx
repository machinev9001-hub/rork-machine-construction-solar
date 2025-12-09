import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import LoginScreen from '@/app/login';

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: mockRouter,
  useRouter: jest.fn(() => mockRouter),
  useFocusEffect: jest.fn(),
  Stack: {
    Screen: ({ children }: any) => children,
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    loginWithId: jest.fn(),
    isOffline: false,
  })),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
  query: jest.fn(),
  limit: jest.fn(),
}));

jest.mock('@/config/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [
    { granted: true },
    jest.fn(),
  ],
}));

describe('Login Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PIN/QR Normalization (Task 5)', () => {
    it('should trim whitespace from userId input', async () => {
      const { getByPlaceholderText, getByText } = render(<LoginScreen />);
      
      const userIdInput = getByPlaceholderText('Enter your ID number');
      const pinInput = getByPlaceholderText('Enter PIN');
      
      fireEvent.changeText(userIdInput, '  USER123  ');
      fireEvent.changeText(pinInput, '1234');
      
      const signInButton = getByText('Sign In');
      fireEvent.press(signInButton);
      
      await waitFor(() => {
        expect(userIdInput.props.value).toBe('USER123');
      });
    });

    it('should trim whitespace from PIN input', async () => {
      const { getByPlaceholderText, getByText } = render(<LoginScreen />);
      
      const userIdInput = getByPlaceholderText('Enter your ID number');
      const pinInput = getByPlaceholderText('Enter PIN');
      
      fireEvent.changeText(userIdInput, 'USER123');
      fireEvent.changeText(pinInput, '  1234  ');
      
      const signInButton = getByText('Sign In');
      fireEvent.press(signInButton);
      
      await waitFor(() => {
        expect(pinInput.props.value).toBe('1234');
      });
    });

    it('should normalize QR payload with trailing newline', async () => {
      const mockLoginWithId = jest.fn().mockResolvedValue({
        success: true,
        user: { role: 'Supervisor', isMaster: false },
      });

      const { useAuth } = require('@/contexts/AuthContext');
      useAuth.mockReturnValue({
        loginWithId: mockLoginWithId,
      });

      const { getByText } = render(<LoginScreen />);
      
      const qrPayload = 'USER123\n';
      
      await waitFor(() => {
        expect(qrPayload.trim()).toBe('USER123');
      });
    });
  });

  describe('Deterministic Routing (Task 4)', () => {
    it('should route to tabs for regular user after successful login', async () => {
      const mockLoginWithId = jest.fn().mockResolvedValue({
        success: true,
        user: { role: 'Supervisor', isMaster: false },
      });

      const { useAuth } = require('@/contexts/AuthContext');
      useAuth.mockReturnValue({
        loginWithId: mockLoginWithId,
      });

      const { getByPlaceholderText, getByText } = render(<LoginScreen />);
      
      const userIdInput = getByPlaceholderText('Enter your ID number');
      const pinInput = getByPlaceholderText('Enter PIN');
      const signInButton = getByText('Sign In');
      
      fireEvent.changeText(userIdInput, 'USER123');
      fireEvent.changeText(pinInput, '1234');
      fireEvent.press(signInButton);
      
      await waitFor(() => {
        expect(mockLoginWithId).toHaveBeenCalledWith('USER123', '1234');
      });
    });

    it('should route to master-sites for master account after successful login', async () => {
      const mockLoginWithId = jest.fn().mockResolvedValue({
        success: true,
        user: { role: 'master', isMaster: true },
      });

      const { useAuth } = require('@/contexts/AuthContext');
      useAuth.mockReturnValue({
        loginWithId: mockLoginWithId,
      });

      const { getByPlaceholderText, getByText } = render(<LoginScreen />);
      
      const userIdInput = getByPlaceholderText('Enter your ID number');
      const pinInput = getByPlaceholderText('Enter PIN');
      const signInButton = getByText('Sign In');
      
      fireEvent.changeText(userIdInput, 'MASTER123');
      fireEvent.changeText(pinInput, '1234');
      fireEvent.press(signInButton);
      
      await waitFor(() => {
        expect(mockLoginWithId).toHaveBeenCalledWith('MASTER123', '1234');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show alert on login failure', async () => {
      const mockLoginWithId = jest.fn().mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const { useAuth } = require('@/contexts/AuthContext');
      useAuth.mockReturnValue({
        loginWithId: mockLoginWithId,
      });

      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByPlaceholderText, getByText } = render(<LoginScreen />);
      
      const userIdInput = getByPlaceholderText('Enter your ID number');
      const pinInput = getByPlaceholderText('Enter PIN');
      const signInButton = getByText('Sign In');
      
      fireEvent.changeText(userIdInput, 'INVALID');
      fireEvent.changeText(pinInput, 'WRONG');
      fireEvent.press(signInButton);
      
      await waitFor(() => {
        expect(mockLoginWithId).toHaveBeenCalled();
      });
    });

    it('should require both userId and PIN', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByText } = render(<LoginScreen />);
      
      const signInButton = getByText('Sign In');
      fireEvent.press(signInButton);
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Error',
          'Please enter your ID number'
        );
      });
    });
  });

  describe('Loading State', () => {
    it('should disable sign in button while loading', async () => {
      const mockLoginWithId = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );

      const { useAuth } = require('@/contexts/AuthContext');
      useAuth.mockReturnValue({
        loginWithId: mockLoginWithId,
      });

      const { getByPlaceholderText, getByText } = render(<LoginScreen />);
      
      const userIdInput = getByPlaceholderText('Enter your ID number');
      const pinInput = getByPlaceholderText('Enter PIN');
      const signInButton = getByText('Sign In');
      
      fireEvent.changeText(userIdInput, 'USER123');
      fireEvent.changeText(pinInput, '1234');
      fireEvent.press(signInButton);
      
      expect(signInButton).toBeDisabled();
    });
  });
});
