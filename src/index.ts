/**
 * @lollopanta/mdtoimage - Main entry point
 */

export { renderMarkdownToImage } from './renderer/index.js';
export type {
  RenderOptions,
  RenderResult,
  Theme,
  ThemeColors,
  ThemeSpacing,
  ThemeFonts,
  FontConfig,
  WatermarkConfig,
} from './types.js';
export { lightTheme, darkTheme, getTheme, mergeTheme } from './themes/index.js';
