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
import type { NormalizedBlock } from '../parser/index.js';
import { readFileSync } from 'fs';

// Helper function to get heading size (same as in components)
function getHeadingSize(level: number): number {
  const sizes: Record<number, number> = {
    1: 36,
    2: 30,
    3: 24,
    4: 20,
    5: 18,
    6: 16,
  };
  return sizes[level] || 16;
}

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

  // Helper function to create JSX tree
  const createJsxTree = (height: number) => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: `${height}px`,
        backgroundColor: theme.colors.background,
        padding,
        position: 'relative',
      },
      children: [
        ...contentBlocks,
        watermark ? renderWatermark(watermark, width, height, theme) : null,
      ].filter(Boolean),
    },
  });

  // Auto-detect height: use two-pass rendering with onNodeDetected
  let finalHeight: number;
  let finalSvg: string;

  if (options.height) {
    // User specified height, use it directly
    finalHeight = options.height;
    finalSvg = await satori(createJsxTree(finalHeight), {
      width,
      height: finalHeight,
      fonts: satoriFonts,
    });
  } else {
    // Auto-detect: use improved estimation based on content analysis
    // Count actual content to estimate height more accurately
    let estimatedLines = 0;
    let estimatedHeight = padding * 2; // Start with padding
    
    for (const block of blocks) {
      if (block.type === 'code' && block.content) {
        const codeLines = block.content.split('\n').length;
        estimatedLines += codeLines;
        estimatedHeight += codeLines * 20 + theme.spacing.codePadding * 2 + theme.spacing.gap; // Code line height + padding
      } else if (block.type === 'heading') {
        estimatedLines += 1;
        estimatedHeight += getHeadingSize(block.level || 1) * 1.2 + theme.spacing.gap * 0.5;
      } else if (block.type === 'paragraph') {
        // Estimate text wrapping: assume ~80 chars per line at 16px font
        const textLength = block.content?.length || 100;
        const charsPerLine = Math.floor(maxContentWidth / 9); // ~9px per char at 16px font
        const paragraphLines = Math.max(1, Math.ceil(textLength / charsPerLine));
        estimatedLines += paragraphLines;
        estimatedHeight += paragraphLines * 24 + theme.spacing.gap; // 24px line height
      } else if (block.type === 'list') {
        const listItems = block.children?.length || 0;
        estimatedLines += listItems;
        estimatedHeight += listItems * 28 + theme.spacing.gap; // ~28px per list item
      } else if (block.type === 'blockquote') {
        estimatedLines += 2;
        estimatedHeight += 60 + theme.spacing.gap; // Blockquote height
      } else {
        estimatedLines += 1;
        estimatedHeight += 30 + theme.spacing.gap; // Default block height
      }
    }
    
    // Add watermark space if enabled
    if (watermark) {
      estimatedHeight += 40;
    }
    
    // Ensure reasonable bounds
    finalHeight = Math.max(400, Math.min(Math.ceil(estimatedHeight), 20000));

    // Render with calculated height
    finalSvg = await satori(createJsxTree(finalHeight), {
      width,
      height: finalHeight,
      fonts: satoriFonts,
    });
  }

  // Handle different output formats
  const format = options.format || 'png';

  if (format === 'svg') {
    return {
      svg: finalSvg,
      width,
      height: finalHeight,
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
      height: finalHeight,
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
    height: finalHeight,
  };
}
