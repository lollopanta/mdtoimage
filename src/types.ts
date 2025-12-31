/**
 * Core type definitions for @lollopanta/mdtoimage
 */

export interface FontConfig {
  path: string;
  name?: string;
  weight?: number;
  style?: 'normal' | 'italic';
}

export interface ThemeColors {
  background: string;
  text: string;
  heading: Record<1 | 2 | 3 | 4 | 5 | 6, string>;
  code: {
    background: string;
    text: string;
  };
  blockquote: {
    border: string;
    background: string;
    text: string;
  };
  link: string;
}

export interface ThemeSpacing {
  padding: number;
  gap: number;
  blockquotePadding: number;
  codePadding: number;
}

export interface ThemeFonts {
  body: FontConfig;
  heading: FontConfig;
  code: FontConfig;
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  fonts: ThemeFonts;
}

export interface WatermarkConfig {
  enabled?: boolean;
  text?: string;
  opacity?: number;
  fontSize?: number;
  padding?: number;
  color?: string;
}

export interface RenderOptions {
  input: string; // File path or markdown string
  output?: string; // Output file path (optional for base64/SVG returns)
  width?: number;
  height?: number;
  format?: 'png' | 'svg' | 'base64';
  theme?: 'light' | 'dark' | Theme;
  fonts?: {
    body?: string | FontConfig;
    heading?: string | FontConfig;
    code?: string | FontConfig;
  };
  watermark?: boolean | WatermarkConfig;
  maxWidth?: number; // Max content width for responsive layout
}

export interface RenderResult {
  buffer?: Buffer;
  svg?: string;
  base64?: string;
  width: number;
  height: number;
}
