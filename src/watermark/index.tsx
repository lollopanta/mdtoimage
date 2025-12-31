/**
 * Watermark system
 */

import type { Theme, WatermarkConfig } from '../types.js';

const DEFAULT_WATERMARK: Required<WatermarkConfig> = {
  enabled: true,
  text: 'Generated with md-to-image',
  opacity: 0.3,
  fontSize: 12,
  padding: 16,
  color: '#888888',
};

export function normalizeWatermark(
  config: boolean | WatermarkConfig | undefined,
  theme: Theme
): WatermarkConfig | null {
  if (config === false) {
    return null;
  }

  if (config === true || config === undefined) {
    return {
      ...DEFAULT_WATERMARK,
      color: theme.colors.text,
    };
  }

  return {
    ...DEFAULT_WATERMARK,
    ...config,
    enabled: config.enabled !== false,
    color: config.color || theme.colors.text,
  };
}

export function renderWatermark(
  watermark: WatermarkConfig,
  width: number,
  height: number,
  theme: Theme
): any {
  if (!watermark.enabled) {
    return null;
  }

  const fontSize = watermark.fontSize || DEFAULT_WATERMARK.fontSize;
  const padding = watermark.padding || DEFAULT_WATERMARK.padding;
  const opacity = watermark.opacity ?? DEFAULT_WATERMARK.opacity;
  const color = watermark.color || theme.colors.text;
  const text = watermark.text || DEFAULT_WATERMARK.text;

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: padding,
        right: padding,
        fontSize,
        color,
        opacity,
        fontFamily: theme.fonts.body.name || 'Inter',
        pointerEvents: 'none',
      },
      children: text,
    },
  };
}
