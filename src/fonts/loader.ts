/**
 * Font loading and embedding utilities
 */

import { readFileSync } from 'fs';
import type { FontConfig } from '../types.js';

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: 'normal' | 'italic';
}

/**
 * Load font from filesystem
 */
export function loadFont(config: FontConfig): LoadedFont {
  const fontData = readFileSync(config.path);
  // Convert weight to valid Satori weight (100-900 in steps of 100)
  const weight = config.weight 
    ? Math.max(100, Math.min(900, Math.round(config.weight / 100) * 100)) as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
    : 400;
  
  return {
    name: config.name || 'Font',
    data: fontData.buffer,
    weight,
    style: (config.style || 'normal') as 'normal' | 'italic',
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
 * Load font from URL (for fallback fonts)
 */
async function loadFontFromUrl(url: string, name: string, weight: number = 400, style: 'normal' | 'italic' = 'normal'): Promise<LoadedFont> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font from ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    name,
    data: arrayBuffer,
    weight: weight as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900,
    style,
  };
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

  // If no fonts were loaded, use fallback fonts from CDN
  // Note: Satori supports TTF, OTF, and WOFF (but NOT WOFF2)
  if (loaded.length === 0) {
    try {
      // Try Google Fonts API first (serves TTF directly)
      const robotoRegular = await loadFontFromUrl(
        'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf',
        'Roboto',
        400,
        'normal'
      );
      loaded.push(robotoRegular);
      
      const robotoBold = await loadFontFromUrl(
        'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf',
        'Roboto',
        700,
        'normal'
      );
      loaded.push(robotoBold);
    } catch (error) {
      // Fallback to jsDelivr CDN (WOFF format, also supported by Satori)
      try {
        const robotoRegular = await loadFontFromUrl(
          'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.woff',
          'Roboto',
          400,
          'normal'
        );
        loaded.push(robotoRegular);
        
        const robotoBold = await loadFontFromUrl(
          'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-700-normal.woff',
          'Roboto',
          700,
          'normal'
        );
        loaded.push(robotoBold);
      } catch (fallbackError) {
        // If all CDN fonts fail, provide a helpful error message
        console.warn('Failed to load fallback fonts from CDN:', error, fallbackError);
        throw new Error('No fonts available. Please provide at least one font file (TTF or OTF format) using --font-body option, or ensure internet access for fallback fonts.');
      }
    }
  }

  return loaded;
}
