# Copilot Instructions for MACHINE Business Tracker

## Project Overview

This is a native cross-platform mobile application built for business tracking across various industry sectors, with a focus on construction and project management. The app is built using Expo Router and React Native, supporting iOS, Android, and Web platforms.

**App Name:** MACHINE Business Tracker (machine-construction-solar)
**Platform:** Native iOS & Android app, exportable to web
**Framework:** Expo Router + React Native
**Language:** TypeScript with strict type checking

## Technology Stack

- **React Native** - Cross-platform native mobile development framework
- **Expo** - Extension of React Native with additional platform capabilities
- **Expo Router** - File-based routing system supporting web, server functions, and SSR
- **TypeScript** - Type-safe JavaScript with strict mode enabled
- **React Query (@tanstack/react-query)** - Server state management
- **Firebase** - Backend database and authentication
- **Lucide React Native** - Icon library
- **Jest** - Testing framework with React Native Testing Library

## Project Setup

### Prerequisites

- Node.js (install via [nvm](https://github.com/nvm-sh/nvm))
- Bun package manager ([installation guide](https://bun.sh/docs/installation))
- Git for version control

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd rork-machine-construction-solar

# Install dependencies
bun i
```

### Environment Setup

1. Copy `env.example` to `.env` and configure required environment variables
2. Ensure Firebase configuration is properly set up
3. Run `./verify-env.sh` to verify environment configuration

## Build & Development Commands

### Development

```bash
# Start development server
bun run start

# Start with web preview
bun run start:web

# Start with tunnel mode (for device testing)
bun run start:tunnel

# Start iOS simulator
bun run ios

# Start Android emulator
bun run android
```

### Testing

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

### Linting & Type Checking

```bash
# Run ESLint
bun run lint

# Run TypeScript type checking
bun run type-check
```

### Cache Management

```bash
# Clear Expo cache
./expo-clear-cache.sh

# Clear cache and start fresh
bunx expo start --clear
```

## Project Structure

```
├── app/                    # App screens (Expo Router file-based routing)
│   ├── (tabs)/            # Tab navigation screens
│   ├── _layout.tsx        # Root layout configuration
│   ├── login.tsx          # Authentication screens
│   └── *.tsx              # Feature screens (100+ screens)
├── components/            # Reusable React components
├── contexts/              # React context providers
├── utils/                 # Utility functions and helpers
├── types/                 # TypeScript type definitions
├── constants/             # App constants and configuration
├── config/                # Configuration files
├── assets/                # Static assets (images, fonts)
├── __tests__/             # Test files
├── scripts/               # Build and utility scripts
├── app.json              # Expo configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Coding Conventions

### TypeScript

- **Always use TypeScript** for all new files
- **Strict mode is enabled** - ensure type safety
- Use explicit types over `any` whenever possible
- Use path aliases: `@/*` maps to project root (e.g., `import { thing } from '@/utils/helper'`)
- File extensions: `.tsx` for components, `.ts` for utilities

### React Native Best Practices

- Use functional components with hooks (no class components)
- Follow React Native's platform-specific patterns when needed
- Use Expo Router's file-based routing for navigation
- Leverage Expo's built-in modules before adding third-party dependencies

### Component Structure

- Keep components focused and single-responsibility
- Extract reusable logic into custom hooks
- Place shared components in `/components` directory
- Co-locate component-specific utilities when appropriate

### State Management

- Use React Query for server state and data fetching
- Use Zustand for client-side global state
- Use React Context for theme and auth state
- Prefer local state (useState) for component-specific state

### Testing

- Write tests for new features and bug fixes
- Place test files in `__tests__/` directory
- Use `.test.tsx` or `.test.ts` naming convention
- Follow existing test patterns using Jest and React Native Testing Library
- Ensure tests pass before submitting changes

### Code Style

- Follow the ESLint configuration (`eslint.config.js`)
- Use 2 spaces for indentation
- Use single quotes for strings (enforced by ESLint)
- Run `bun run lint` before committing

### Git Commits

- Write clear, descriptive commit messages
- Keep commits focused on a single change
- Reference issue numbers when applicable

## Firebase Integration

- This project uses Firebase for backend services
- Firestore rules are defined in `firestore.rules`
- Firestore indexes are configured in `firestore.indexes.json`
- Set up Firebase indexes using `firebase-indexes-setup.html`

## Platform-Specific Considerations

### iOS

- Bundle identifier: `app.rork.project-management-tracker-clone-clone-ok90lky`
- Requires camera, microphone, photo library, and location permissions
- Supports tablets
- Uses iCloud storage

### Android

- Package name: `app.rork.project_management_tracker_clone_clone_ok90lky`
- Requires various permissions (camera, location, storage, etc.)
- Uses adaptive icons

### Web

- Uses Metro bundler
- Some native features may not be available

## Key Features

This app includes extensive features for construction and project management:

- **User Management:** Multiple user roles (operators, supervisors, planners, managers)
- **Time Tracking:** Employee timesheets, billable hours calculation
- **Asset Management:** Plant/equipment tracking, QR code generation/scanning
- **Task Management:** Activity tracking, checklist management
- **Progress Reporting:** Real-time progress updates, analytics
- **Authentication:** Face recognition, PIN-based auth
- **Offline Support:** Async storage for local data persistence
- **Real-time Sync:** Data synchronization with Firebase

## Testing on Devices

### Physical Devices

1. Download Rork app (iOS App Store) or Expo Go (iOS/Android)
2. Run `bun run start` and scan QR code

### Simulators/Emulators

- **iOS Simulator:** Run `bun run start` then press "i"
- **Android Emulator:** Run `bun run start` then press "a"
- **Web Browser:** Run `bun run start:web`

## Deployment

### App Store (iOS)

```bash
bun i -g @expo/eas-cli
eas build:configure
eas build --platform ios
eas submit --platform ios
```

### Google Play (Android)

```bash
eas build --platform android
eas submit --platform android
```

### Web Deployment

```bash
eas build --platform web
eas hosting:configure
eas hosting:deploy
```

## Troubleshooting

### Common Issues

1. **App not loading:** Ensure device and computer are on same WiFi, or use tunnel mode
2. **Build failing:** Clear cache with `bunx expo start --clear` or reinstall dependencies
3. **Type errors:** Run `bun run type-check` to identify TypeScript issues
4. **Test failures:** Run `bun run test` to see specific test errors

### Getting Help

- Check Expo documentation: https://docs.expo.dev/
- Review React Native docs: https://reactnative.dev/
- See project README.md for additional guidance

## Important Notes for Copilot

1. **Minimal Changes:** Make the smallest possible changes to achieve the goal
2. **Type Safety:** Always maintain TypeScript strict mode compliance
3. **Testing:** Run tests after making changes (`bun run test`)
4. **Linting:** Ensure code passes linting (`bun run lint`)
5. **Mobile-First:** Remember this is a mobile app - consider mobile UX and performance
6. **Offline Capability:** Consider offline scenarios when making data-related changes
7. **Cross-Platform:** Test changes work on iOS, Android, and Web when possible
8. **Existing Patterns:** Follow established patterns in the codebase for consistency
9. **Firebase Integration:** Be careful with Firestore queries and security rules
10. **Performance:** Consider bundle size and rendering performance for mobile devices
