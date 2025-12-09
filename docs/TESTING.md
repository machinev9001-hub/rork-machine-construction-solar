# Testing Guide

## Overview
This document consolidates all testing information including setup, configuration, and test execution.

---

## Test Setup

### Dependencies
```json
{
  "jest": "^29.7.0",
  "@testing-library/react-native": "^12.4.0",
  "@testing-library/jest-native": "^5.4.3",
  "jest-expo": "^51.0.0",
  "@types/jest": "^29.5.11"
}
```

### Configuration Files

**jest.config.js**
```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

**jest.setup.js**
```javascript
import '@testing-library/jest-native/extend-expect';
```

---

## Running Tests

### Basic Commands
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage

# Run TypeScript type checking
bun type-check

# Run linting
bun lint

# Run all quality checks
npm run check
```

### Test Scripts (Add to package.json)
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "type-check": "tsc --noEmit",
    "lint": "eslint .",
    "check": "npm run type-check && npm run lint && npm run test"
  }
}
```

---

## Test Structure

### Directory Layout
```
__tests__/
├── example.test.tsx          # Example test
├── login.test.tsx            # Login flow tests
├── coldStart.test.tsx        # Cold start performance
├── analytics.test.tsx        # Analytics tests
└── debugHelpers.test.tsx     # Debug utility tests
```

### Naming Conventions
- Test files: `*.test.tsx` or `*.test.ts`
- Place in `__tests__/` directory
- Follow pattern: `ComponentName.test.tsx`

---

## Writing Tests

### Basic Test Example
```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('Example Test Suite', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('can render a simple component', () => {
    const { getByText } = render(<Text>Hello World</Text>);
    expect(getByText('Hello World')).toBeTruthy();
  });
});
```

### Component Testing
```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MyButton from '@/components/MyButton';

describe('MyButton', () => {
  it('calls onPress when tapped', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <MyButton onPress={onPressMock}>Click Me</MyButton>
    );
    
    fireEvent.press(getByText('Click Me'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('displays correct text', () => {
    const { getByText } = render(<MyButton>Test Button</MyButton>);
    expect(getByText('Test Button')).toBeTruthy();
  });
});
```

### Async Testing
```typescript
import { render, waitFor } from '@testing-library/react-native';

describe('Async Component', () => {
  it('loads data', async () => {
    const { getByText } = render(<MyAsyncComponent />);
    
    await waitFor(() => {
      expect(getByText('Data loaded')).toBeTruthy();
    });
  });
});
```

### Mocking Firebase
```typescript
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({
    docs: [
      { id: '1', data: () => ({ name: 'Test' }) }
    ]
  })),
}));
```

---

## Test Categories

### 1. Unit Tests
Test individual functions and components in isolation.

**Example:**
```typescript
import { calculateProgress } from '@/utils/progressCalculations';

describe('calculateProgress', () => {
  it('calculates percentage correctly', () => {
    const result = calculateProgress(50, 100);
    expect(result).toBe(50);
  });

  it('handles zero total', () => {
    const result = calculateProgress(0, 0);
    expect(result).toBe(0);
  });
});
```

### 2. Integration Tests
Test multiple components working together.

**Example:**
```typescript
import { render, fireEvent } from '@testing-library/react-native';
import LoginScreen from '@/app/login';

describe('Login Flow', () => {
  it('logs in user successfully', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Master ID'), 'test123');
    fireEvent.changeText(getByPlaceholderText('PIN'), '1234');
    fireEvent.press(getByText('Login'));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/master-sites');
    });
  });
});
```

### 3. Performance Tests
Test app performance metrics.

**Example:**
```typescript
describe('Cold Start Performance', () => {
  it('loads within acceptable time', async () => {
    const startTime = Date.now();
    render(<App />);
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // 3 seconds
  });
});
```

---

## Comprehensive Test Checklist

### Authentication & Login
- [ ] Master account login with PIN
- [ ] Employee login with ID number + PIN
- [ ] QR code scanning
- [ ] Session timeout after 5 minutes
- [ ] Page refresh clears session
- [ ] Offline authentication with cached users

### Request Workflows
- [ ] Create task request offline
- [ ] Task request appears in planner view when online
- [ ] Approve/reject request
- [ ] Supervisor receives notification
- [ ] Activity/scope request workflow
- [ ] QC request workflow
- [ ] Cabling request workflow
- [ ] Termination request workflow
- [ ] Handover request workflow

### Offline System
- [ ] Queue operations when offline
- [ ] P0 operations sync first
- [ ] Banner shows pending count
- [ ] Manual sync triggers correctly
- [ ] Failed operations can be retried
- [ ] User cache works offline

### Data Freshness
- [ ] Real-time listeners update data
- [ ] Timestamp comparison chooses fresher data
- [ ] P0 sync notification appears
- [ ] Pull-to-refresh works

### Company & Multi-tenant
- [ ] Create company
- [ ] Select company
- [ ] Create site within company
- [ ] Data isolation between companies
- [ ] Industry sector filtering

### Plant Asset Management
- [ ] Allocate asset to site
- [ ] Track asset hours
- [ ] Operator timesheet recording
- [ ] Asset usage reports

### Onboarding
- [ ] Add employee
- [ ] Add asset
- [ ] Asset checklist completion
- [ ] Induction messages

### Progress Tracking
- [ ] Enter completed today value
- [ ] Completed today lock prevents duplicates
- [ ] Progress syncs to dashboard
- [ ] BOQ calculations correct

### Locking Systems
- [ ] Task lock prevents concurrent edits
- [ ] Completed today lock prevents same-day duplicates
- [ ] QC toggle lock prevents same-day toggles
- [ ] Locks reset at midnight

---

## Smoke Test Script

Create `scripts/run-smoke.sh`:
```bash
#!/bin/bash
echo "Running smoke tests..."

# Start Metro bundler in background
npm start &
METRO_PID=$!

# Wait for Metro to start
sleep 5

# Run critical path tests
npm run test -- --testPathPattern="(login|coldStart|analytics)"

# Kill Metro
kill $METRO_PID

echo "Smoke tests complete"
```

Make executable:
```bash
chmod +x scripts/run-smoke.sh
```

Run:
```bash
./scripts/run-smoke.sh
```

---

## Coverage Reports

### Generate Coverage
```bash
bun test:coverage
```

### Coverage Output
```
---------------------|---------|----------|---------|---------|-------------------
File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------------|---------|----------|---------|---------|-------------------
All files            |   75.50 |    68.25 |   72.15 |   76.30 |
 utils/              |   82.40 |    75.10 |   80.20 |   83.50 |
  messaging.ts       |   90.15 |    85.30 |   88.75 |   91.20 | 45-52, 78
  scope.ts           |   78.60 |    70.20 |   75.40 |   79.80 | 23-30, 56-62
 components/         |   70.25 |    62.50 |   68.90 |   71.40 |
  RequestCard.tsx    |   75.80 |    68.40 |   72.50 |   76.90 | 34-40
---------------------|---------|----------|---------|---------|-------------------
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun type-check
      - run: bun lint
      - run: bun test --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Debugging Tests

### Run Single Test File
```bash
bun test __tests__/login.test.tsx
```

### Run Single Test Case
```bash
bun test -t "logs in user successfully"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Show Console Logs
```bash
bun test --verbose
```

---

## Best Practices

### 1. Follow AAA Pattern
```typescript
it('calculates total correctly', () => {
  // Arrange
  const items = [10, 20, 30];
  
  // Act
  const total = calculateTotal(items);
  
  // Assert
  expect(total).toBe(60);
});
```

### 2. Test User Behavior, Not Implementation
```typescript
// ❌ Bad
it('calls handleSubmit function', () => {
  expect(component.handleSubmit).toHaveBeenCalled();
});

// ✅ Good
it('submits form data when button pressed', async () => {
  fireEvent.press(getByText('Submit'));
  await waitFor(() => {
    expect(getByText('Success')).toBeTruthy();
  });
});
```

### 3. Use Descriptive Test Names
```typescript
// ❌ Bad
it('test 1', () => { ... });

// ✅ Good
it('displays error message when login fails', () => { ... });
```

### 4. Keep Tests Independent
```typescript
// Each test should setup and teardown its own data
beforeEach(() => {
  // Setup
});

afterEach(() => {
  // Cleanup
});
```

### 5. Mock External Dependencies
```typescript
jest.mock('@/utils/analytics', () => ({
  logEvent: jest.fn(),
  setUserId: jest.fn(),
}));
```

---

## Common Issues

### Issue 1: Tests Timeout
**Solution:** Increase timeout
```typescript
jest.setTimeout(10000); // 10 seconds
```

### Issue 2: Firebase Mock Not Working
**Solution:** Mock at module level
```typescript
jest.mock('firebase/firestore', () => ({
  // ... mocks
}));
```

### Issue 3: Async State Updates
**Solution:** Use `waitFor`
```typescript
await waitFor(() => {
  expect(getByText('Loaded')).toBeTruthy();
});
```

---

## Related Files

**Test Files:**
- `__tests__/example.test.tsx` - Example tests
- `__tests__/login.test.tsx` - Login tests
- `__tests__/coldStart.test.tsx` - Performance tests
- `__tests__/analytics.test.tsx` - Analytics tests

**Configuration:**
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Test setup
- `scripts/run-smoke.sh` - Smoke test script
- `scripts/run-quality-checks.sh` - Full quality check script

**Archived Docs:**
- `TESTING.md` (archived)
- `TEST_SETUP_COMPLETE.md` (archived)
- `ADD_TEST_SCRIPTS.md` (archived)
- `COLD_START_TEST_PLAN.md` (archived)
- `TEST_EXECUTION_GUIDE.md` (archived)
- `TEST_RESULTS_VALIDATION.md` (archived)
- `COMPREHENSIVE_TEST_CHECKLIST.md` (archived)

---

**Last Updated:** 2025-01-23  
**Status:** Complete and production-ready
