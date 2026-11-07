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

function textLength(block: NormalizedBlock): number {
  return (block.content?.length || 0) + (block.children || []).reduce((sum, child) => sum + textLength(child), 0);
}

function countLines(block: NormalizedBlock): number {
  if (block.type === 'code') return Math.max(1, (block.content || '').split('\n').length);
  if (block.type === 'heading' || block.type === 'paragraph') return Math.max(1, Math.ceil(textLength(block) / 90));
  if (block.type === 'listItem') return Math.max(1, (block.children || []).reduce((sum, child) => sum + countLines(child), 0));
  return (block.children || []).reduce((sum, child) => sum + countLines(child), 0);
}

function normalizeGithubHtml(markdown: string): string {
  const preserved: string[] = [];
  const placeholder = (value: string) => `MDTOIMAGEPRESERVED${preserved.push(value) - 1}TOKEN`;
  // HTML-looking samples inside fenced or inline code must remain literal.
  markdown = markdown.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm, placeholder);
  markdown = markdown.replace(/(`+)(?!`)(?:\\.|[\s\S])*?(?<!`)\1(?!`)/g, placeholder);
  markdown = markdown
    .replace(/<img\b([^>]*)\/?>/gi, (_tag, attributes: string) => {
      const alt = attributes.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
      const src = attributes.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
      return src ? `![${alt.replace(/\]/g, '\\\\]')}](${src})` : alt;
    })
    .replace(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi, '[')
    .replace(/<\/a\s*>/gi, ']')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div\s*>/gi, '\n\n')
    .replace(/<\/?(?:div|center|p|span|section|article|table|tbody|tr|td|th|thead|details|summary)\b[^>]*>/gi, '')
    .replace(/<\/?(?:strong|b)\s*>/gi, '**')
    .replace(/<\/?(?:em|i)\s*>/gi, '*');
  return markdown.replace(/MDTOIMAGEPRESERVED(\d+)TOKEN/g, (_match, index: string) => preserved[Number(index)] || '');
}

async function prepareImageSources(node: any, cache = new Map<string, string>()): Promise<void> {
  if (!node || typeof node !== 'object') return;
  const props = node.props;
  if (node.type === 'img' && typeof props?.src === 'string' && /^https?:\/\//i.test(props.src)) {
    const source = props.src;
    try {
      let dataUri = cache.get(source);
      if (!dataUri) {
        const response = await fetch(source, { signal: AbortSignal.timeout(10000) });
        const length = Number(response.headers.get('content-length'));
        if (!response.ok || (length && length > 8 * 1024 * 1024)) throw new Error(`Image request failed (${response.status})`);
        const input = Buffer.from(await response.arrayBuffer());
        if (input.length > 8 * 1024 * 1024) throw new Error('Image is larger than 8 MB');
        const metadata = await sharp(input).metadata();
        const intrinsicWidth = metadata.width || Number(props.width) || 1;
        const intrinsicHeight = metadata.height || Number(props.height) || 1;
        const imageWidth = Math.max(1, Math.min(Number(props.width) || intrinsicWidth, intrinsicWidth));
        const imageHeight = Math.max(1, Math.round(imageWidth * intrinsicHeight / intrinsicWidth));
        props.width = imageWidth;
        props.height = imageHeight;
        const png = await sharp(input).resize({ width: imageWidth, height: imageHeight, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
        dataUri = `data:image/png;base64,${png.toString('base64')}`;
        cache.set(source, dataUri);
      }
      props.src = dataUri;
    } catch {
      node.type = 'span';
      node.props = { children: props.alt || '[image unavailable]' };
    }
  }
  for (const child of props?.children || []) await prepareImageSources(child, cache);
}

/**
 * Render markdown to image
 */
export async function renderMarkdownToImage(options: RenderOptions): Promise<RenderResult> {
  if (!options || typeof options.input !== 'string' || !options.input.trim()) throw new Error('input must be a non-empty Markdown string or file path');
  const width = options.width ?? 1200;
  if (!Number.isFinite(width) || width <= 0) throw new Error('width must be a positive number');
  if (options.height !== undefined && (!Number.isFinite(options.height) || options.height <= 0)) throw new Error('height must be a positive number');
  if (options.maxWidth !== undefined && (!Number.isFinite(options.maxWidth) || options.maxWidth <= 0)) throw new Error('maxWidth must be a positive number');
  if (options.format !== undefined && !['png', 'svg', 'base64'].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  // Load markdown content
  let markdown: string;
  if (/\r|\n/.test(options.input) || /[#*`_[\]()>|]/.test(options.input)) {
    markdown = options.input;
  } else {
    try { markdown = readFileSync(options.input, 'utf-8'); }
    catch { markdown = options.input; }
  }

  // Parse markdown
  // GitHub READMEs often use HTML only as layout wrappers around Markdown.
  // Convert common HTML constructs into Markdown before parsing so opening
  // and closing tags split across mdast nodes do not discard their contents.
  markdown = normalizeGithubHtml(markdown);

  const mdxInput = /(^|\n)\s*(?:import\s|export\s)|<\w[\w.-]*(?:\s[^>]*)?\s*\/>|\{[^\n{}]+\}/m.test(markdown);
  const ast = await parseMarkdown(markdown, mdxInput);
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
  const maxContentWidth = options.maxWidth ?? width - theme.spacing.padding * 2;
  const padding = theme.spacing.padding;

  // Determine theme mode for Shiki
  const themeMode = typeof options.theme === 'string' ? options.theme : (options.theme?.colors.background === darkTheme.colors.background ? 'dark' : 'light');
  
  // Render blocks to JSX (async)
  const contentBlocks = await Promise.all(
    blocks.map((block) => renderBlock(block, theme, maxContentWidth, themeMode))
  );
  await Promise.all(contentBlocks.map(block => prepareImageSources(block)));

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
        const paragraphLength = textLength(block);
        const charsPerLine = Math.floor(maxContentWidth / 9); // ~9px per char at 16px font
        const paragraphLines = Math.max(1, Math.ceil(paragraphLength / charsPerLine));
        estimatedLines += paragraphLines;
        estimatedHeight += paragraphLines * 24 + theme.spacing.gap; // 24px line height
      } else if (block.type === 'list') {
        const listLines = countLines(block);
        estimatedLines += listLines;
        estimatedHeight += listLines * 28 + theme.spacing.gap; // ~28px per list line
      } else if (block.type === 'blockquote') {
        const quoteLines = countLines(block);
        estimatedLines += quoteLines;
        estimatedHeight += quoteLines * 28 + theme.spacing.gap;
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
    if (options.output) await import('node:fs/promises').then(fs => fs.writeFile(options.output!, finalSvg, 'utf8'));
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
  if (options.output) await import('node:fs/promises').then(fs => fs.writeFile(options.output!, pngBuffer));

  return {
    buffer: pngBuffer,
    width,
    height: finalHeight,
  };
}
