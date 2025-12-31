/**
 * Theme system with design tokens
 */

import type { Theme, FontConfig } from '../types.js';

const defaultFonts: { body: FontConfig; heading: FontConfig; code: FontConfig } = {
  body: {
    path: '',
    name: 'Inter',
    weight: 400,
    style: 'normal',
  },
  heading: {
    path: '',
    name: 'Inter',
    weight: 700,
    style: 'normal',
  },
  code: {
    path: '',
    name: 'JetBrains Mono',
    weight: 400,
    style: 'normal',
  },
};

export const lightTheme: Theme = {
  colors: {
    background: '#ffffff',
    text: '#1a1a1a',
    heading: {
      1: '#000000',
      2: '#1a1a1a',
      3: '#2a2a2a',
      4: '#3a3a3a',
      5: '#4a4a4a',
      6: '#5a5a5a',
    },
    code: {
      background: '#f5f5f5',
      text: '#1a1a1a',
    },
    blockquote: {
      border: '#e0e0e0',
      background: '#f9f9f9',
      text: '#4a4a4a',
    },
    link: '#0066cc',
  },
  spacing: {
    padding: 40,
    gap: 24,
    blockquotePadding: 20,
    codePadding: 16,
  },
  fonts: defaultFonts,
};

export const darkTheme: Theme = {
  colors: {
    background: '#1a1a1a',
    text: '#e0e0e0',
    heading: {
      1: '#ffffff',
      2: '#f0f0f0',
      3: '#e0e0e0',
      4: '#d0d0d0',
      5: '#c0c0c0',
      6: '#b0b0b0',
    },
    code: {
      background: '#2a2a2a',
      text: '#e0e0e0',
    },
    blockquote: {
      border: '#404040',
      background: '#252525',
      text: '#b0b0b0',
    },
    link: '#4da6ff',
  },
  spacing: {
    padding: 40,
    gap: 24,
    blockquotePadding: 20,
    codePadding: 16,
  },
  fonts: defaultFonts,
};

export function getTheme(name: 'light' | 'dark' | Theme): Theme {
  if (typeof name === 'object') {
    return name;
  }
  return name === 'dark' ? darkTheme : lightTheme;
}

export function mergeTheme(base: Theme, overrides: Partial<Theme>): Theme {
  return {
    colors: { ...base.colors, ...overrides.colors },
    spacing: { ...base.spacing, ...overrides.spacing },
    fonts: { ...base.fonts, ...overrides.fonts },
  };
}
