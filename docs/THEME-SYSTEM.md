# Theme System Implementation

> **⚠️ NOTICE: This file has been consolidated into [TECHNICAL-GUIDE.md](./TECHNICAL-GUIDE.md)**  
> Please refer to the new consolidated documentation for the most up-to-date information.  
> This file is kept for reference but may not be maintained going forward.

## Overview
All screens in the app now use a centralized theme system defined in `constants/colors.ts`. The theme provides a consistent dark appearance with black background across all screens.

## Theme Colors
The main theme colors are defined in `Colors` object:
- `background: '#000000'` - Main screen background (black)
- `text: '#FFFFFF'` - Primary text color (white)
- `textSecondary: '#A0A0A0'` - Secondary text color (gray)
- `accent: '#FFD600'` - Accent color (yellow)
- `surface: '#1A1A1A'` - Surface elements like headers (dark gray)
- `border: '#333333'` - Borders and dividers (medium gray)
- `cardBg: '#FFFFFF'` - Card backgrounds (white)
- `headerBg: '#000000'` - Header backgrounds (black)

## Usage

### Importing the Theme
```typescript
import { Colors } from '@/constants/colors';
```

### Applying Theme Colors
Use the `Colors` object in your StyleSheet instead of hardcoded values:

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background, // Instead of '#000000' or other colors
  },
  header: {
    backgroundColor: Colors.surface,
    borderBottomColor: Colors.border,
  },
  text: {
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderColor: Colors.border,
  },
});
```

## Using the Theme Hook
For more complex scenarios, use the `useTheme` hook:

```typescript
import { useTheme } from '@/utils/hooks/useTheme';

function MyComponent() {
  const { theme, roleAccentColor, commonStyles } = useTheme();
  
  return (
    <View style={commonStyles.container}>
      {/* ... */}
    </View>
  );
}
```

## ThemedScreen Component
For simple screens, you can use the `ThemedScreen` wrapper component:

```typescript
import { ThemedScreen } from '@/components/ThemedScreen';

export default function MyScreen() {
  return (
    <ThemedScreen>
      {/* Your content */}
    </ThemedScreen>
  );
}
```

## Migration Guide

To update an existing screen to use the theme:

1. Import the Colors:
```typescript
import { Colors } from '@/constants/colors';
```

2. Replace hardcoded colors in styles:
- `backgroundColor: '#f8fafc'` → `backgroundColor: Colors.background`
- `backgroundColor: '#fff'` → `backgroundColor: Colors.cardBg`
- `color: '#1e293b'` → `color: Colors.text` or `color: Colors.background` (for text on cards)
- `color: '#64748b'` → `color: Colors.textSecondary`
- `borderColor: '#e2e8f0'` → `borderColor: Colors.border`

3. Update header styles:
```typescript
header: {
  backgroundColor: Colors.surface,
  borderBottomColor: Colors.border,
},
headerTitle: {
  color: Colors.text,
},
```

## Updated Screens
The following screens have been updated to use the theme:
- ✅ app/onboarding-employee-detail.tsx
- ✅ app/add-subcontractor.tsx
- ✅ app/add-employee.tsx
- ✅ app/(tabs)/index.tsx (Home screen)

## Role-Based Accent Colors
The theme also provides role-based accent colors via `getRoleAccentColor(role)`:
- master: '#FFD600'
- Admin: '#3B82F6'
- Planner: '#10B981'
- Supervisor: '#F59E0B'
- QC: '#EF4444'
- And more...

Use these for role-specific UI elements like borders, buttons, and highlights.

## Future Theme Library
This theme system is designed to be easily extendable. Future enhancements may include:
- Light/dark mode toggle
- Multiple theme presets
- User-customizable themes
- Theme persistence in AsyncStorage

## Best Practices
1. **Always use theme colors** instead of hardcoded color values
2. **Use the useTheme hook** for dynamic theming based on user role
3. **Keep accessibility in mind** - ensure sufficient contrast
4. **Test on both light and dark device settings** to ensure theme overrides work correctly
5. **Use ThemedScreen component** for simple screens to reduce boilerplate
