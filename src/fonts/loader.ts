/**
 * Font loading and embedding utilities
 */

import { readFileSync } from 'fs';
import type { FontConfig } from '../types.js';

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight?: number;
  style?: string;
}

/**
 * Load font from filesystem
 */
export function loadFont(config: FontConfig): LoadedFont {
  const fontData = readFileSync(config.path);
  return {
    name: config.name || 'Font',
    data: fontData.buffer,
    weight: config.weight || 400,
    style: config.style || 'normal',
  };
}

/**
 * Normalize font config (string path or FontConfig object)
 */
export function normalizeFontConfig(
  input: string | FontConfig | undefined,
  fallback: FontConfig
): FontConfig {
  if (!input) {
    return fallback;
  }
  if (typeof input === 'string') {
    return { ...fallback, path: input };
  }
  return { ...fallback, ...input };
}

/**
 * Load all fonts for Satori
 */
export async function loadFontsForSatori(
  fonts: { body: FontConfig; heading: FontConfig; code: FontConfig }
): Promise<LoadedFont[]> {
  const loaded: LoadedFont[] = [];

  try {
    if (fonts.body.path) {
      loaded.push(loadFont(fonts.body));
    }
  } catch (error) {
    console.warn(`Failed to load body font: ${fonts.body.path}`, error);
  }

  try {
    if (fonts.heading.path) {
      loaded.push(loadFont(fonts.heading));
    }
  } catch (error) {
    console.warn(`Failed to load heading font: ${fonts.heading.path}`, error);
  }

  try {
    if (fonts.code.path) {
      loaded.push(loadFont(fonts.code));
    }
  } catch (error) {
    console.warn(`Failed to load code font: ${fonts.code.path}`, error);
  }

  return loaded;
}
