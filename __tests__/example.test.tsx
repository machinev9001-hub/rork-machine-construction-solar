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
