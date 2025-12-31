/**
 * Main renderer: Markdown → AST → JSX → SVG → PNG
 */

import satori from 'satori';
import sharp from 'sharp';
import { parseMarkdown, normalizeAST } from '../parser/index.js';
import { renderBlock } from '../components/index.js';
import { getTheme, mergeTheme, darkTheme } from '../themes/index.js';
import { normalizeWatermark, renderWatermark } from '../watermark/index.js';
import { loadFontsForSatori, normalizeFontConfig } from '../fonts/loader.js';
import type { RenderOptions, RenderResult, Theme } from '../types.js';
import { readFileSync } from 'fs';

/**
 * Render markdown to image
 */
export async function renderMarkdownToImage(options: RenderOptions): Promise<RenderResult> {
  // Load markdown content
  let markdown: string;
  try {
    markdown = readFileSync(options.input, 'utf-8');
  } catch {
    // Assume it's a markdown string if file doesn't exist
    markdown = options.input;
  }

  // Parse markdown
  const ast = await parseMarkdown(markdown);
  const blocks = normalizeAST(ast);

  // Get theme
  const baseTheme = getTheme(options.theme || 'light');
  
  // Merge custom fonts
  const fonts = {
    body: normalizeFontConfig(options.fonts?.body, baseTheme.fonts.body),
    heading: normalizeFontConfig(options.fonts?.heading, baseTheme.fonts.heading),
    code: normalizeFontConfig(options.fonts?.code, baseTheme.fonts.code),
  };

  const theme: Theme = {
    ...baseTheme,
    fonts,
  };

  // Load fonts for Satori
  const satoriFonts = await loadFontsForSatori(theme.fonts);

  // Calculate dimensions
  const width = options.width || 1200;
  const maxContentWidth = options.maxWidth || width - theme.spacing.padding * 2;
  const padding = theme.spacing.padding;

  // Determine theme mode for Shiki
  const themeMode = typeof options.theme === 'string' ? options.theme : (options.theme?.colors.background === darkTheme.colors.background ? 'dark' : 'light');
  
  // Render blocks to JSX (async)
  const contentBlocks = await Promise.all(
    blocks.map((block) => renderBlock(block, theme, maxContentWidth, themeMode))
  );

  // Normalize watermark
  const watermark = normalizeWatermark(options.watermark, theme);

  // Create JSX tree
  const jsxTree = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.background,
        padding,
        position: 'relative',
      },
      children: [
        ...contentBlocks,
        watermark ? renderWatermark(watermark, width, 0, theme) : null,
      ].filter(Boolean),
    },
  };

  // Estimate height based on content
  // Rough estimate: ~50px per block + padding + watermark
  const estimatedHeight = options.height || Math.max(
    800,
    blocks.length * 50 + padding * 2 + (watermark ? 40 : 0)
  );

  // Render to SVG with Satori
  // Note: Satori requires a fixed height, so we use estimated height
  // For better results, users should specify height or we could do a two-pass render
  const finalSvg = await satori(jsxTree, {
    width,
    height: estimatedHeight,
    fonts: satoriFonts,
  });

  // Extract actual rendered height from SVG
  const heightMatch = finalSvg.match(/height="(\d+)"/);
  const height = heightMatch ? parseInt(heightMatch[1], 10) : estimatedHeight;

  // Handle different output formats
  const format = options.format || 'png';

  if (format === 'svg') {
    return {
      svg: finalSvg,
      width,
      height,
    };
  }

  // Convert SVG to PNG with Sharp
  const pngBuffer = await sharp(Buffer.from(finalSvg))
    .png()
    .toBuffer();

  if (format === 'base64') {
    return {
      base64: pngBuffer.toString('base64'),
      width,
      height,
    };
  }

  // Save to file if output path provided
  if (options.output) {
    await sharp(Buffer.from(finalSvg))
      .png()
      .toFile(options.output);
  }

  return {
    buffer: pngBuffer,
    width,
    height,
  };
}
