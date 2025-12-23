import React from "react";
'use strict';

const { registerRootComponent } = require('expo');

function App() {
  console.log('[custom expo-router entry] App() mounted');

  let ExpoRoot;
  try {
    ExpoRoot = require('expo-router').ExpoRoot;
  } catch (e) {
    console.error('[custom expo-router entry] Failed to import expo-router ExpoRoot', e);
  }

  if (!ExpoRoot) {
    const { View, Text } = require('react-native');
    return React.createElement(
      View,
      { style: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } },
      React.createElement(
        Text,
        { selectable: true },
        'expo-router failed to load.\n\nTry clearing cache / restarting the dev server.'
      )
    );
  }

  const ctx = require.context('../app');
  return React.createElement(ExpoRoot, { context: ctx });
}

registerRootComponent(App);

module.exports = App;
