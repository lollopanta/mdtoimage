/**
 * JSX components for rendering Markdown blocks
 */

import type { NormalizedBlock } from '../parser/index.js';
import type { Theme } from '../types.js';
import { tokenizeCode, tokensToSatori } from '../highlighter/index.js';

export interface ComponentProps {
  block: NormalizedBlock;
  theme: Theme;
  maxWidth?: number;
}

function plainInlineText(block: NormalizedBlock): string {
  if (block.type === 'image') return block.alt || '';
  if (block.type === 'link') return (block.children || []).map(plainInlineText).join('');
  return ((block.content || '').replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')) + (block.children || []).map(plainInlineText).join('');
}

/**
 * Render a normalized block tree to JSX
 */
export async function renderBlock(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  switch (block.type) {
    case 'heading':
      return await renderHeading(block, theme, maxWidth, themeMode);
    case 'paragraph':
      return await renderParagraph(block, theme, maxWidth, themeMode);
    case 'code':
      return await renderCodeBlock(block, theme, maxWidth, themeMode);
    case 'inlineCode':
      return renderInlineCode(block, theme);
    case 'blockquote':
      return await renderBlockquote(block, theme, maxWidth, themeMode);
    case 'list':
      return await renderList(block, theme, maxWidth, themeMode);
    case 'listItem':
      return await renderListItem(block, theme, maxWidth, themeMode);
    case 'thematicBreak':
      return renderThematicBreak(theme, maxWidth);
    case 'text':
      return block.content || '';
    case 'strong':
      return await renderStrong(block, theme, themeMode);
    case 'emphasis':
      return await renderEmphasis(block, theme, themeMode);
    case 'delete':
      return { type: 'span', props: { style: { textDecoration: 'line-through' }, children: await Promise.all((block.children || []).map(child => renderBlock(child, theme, maxWidth, themeMode))) } };
    case 'link':
      return await renderLink(block, theme, themeMode);
    case 'image':
      return renderImage(block, theme);
    case 'table':
      return renderTable(block, theme, maxWidth, themeMode);
    case 'tableRow':
      return { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', width: '100%' }, children: await Promise.all((block.children || []).map(child => renderBlock(child, theme, maxWidth, themeMode))) } };
    case 'tableCell': {
      const content = plainInlineText(block);
      const isHeader = block.content === 'th';
      return { type: 'div', props: { style: { display: 'flex', flex: 1, padding: '8px 10px', border: `1px solid ${theme.colors.blockquote.border}`, fontWeight: isHeader ? 700 : 400 }, children: content } };
    }
    case 'htmlBreak':
      return { type: 'span', props: { children: '\n' } };
    case 'htmlElement': {
      const children = await Promise.all((block.children || []).map(child => renderBlock(child, theme, maxWidth, themeMode)));
      const inline = ['span'].includes(block.content || '');
      const centered = block.attributes?.align === 'center';
      return { type: inline ? 'span' : 'div', props: { style: inline ? { color: theme.colors.text } : { display: 'flex', flexDirection: 'column', alignItems: centered ? 'center' : 'stretch', color: theme.colors.text, width: '100%' }, children } };
    }
    default:
      return null;
  }
}

async function renderHeading(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const level = block.level || 1;
  const fontSize = getHeadingSize(level);
  const color = theme.colors.heading[level as 1 | 2 | 3 | 4 | 5 | 6];
  const fontWeight = theme.fonts.heading.weight || 700;

  const children = plainInlineText(block);

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        fontSize,
        fontWeight,
        color,
        fontFamily: theme.fonts.heading.name || 'Inter',
        marginTop: level >= 3 ? 20 : 24,
        marginBottom: level <= 2 ? 16 : 8,
        paddingBottom: level <= 2 ? 8 : 0,
        ...(level <= 2 ? { borderBottom: `1px solid ${theme.colors.blockquote.border}` } : {}),
        lineHeight: 1.2,
        maxWidth: maxWidth || '100%',
      },
      children,
    },
  };
}

async function renderParagraph(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const imageBlocks = (block.children || []).flatMap(child => child.type === 'image'
    ? [child]
    : child.type === 'link' ? (child.children || []).filter(item => item.type === 'image') : []);
  if (imageBlocks.length) {
    const children = await Promise.all(imageBlocks.map(image => renderBlock(image, theme, maxWidth, themeMode)));
    return { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginBottom: 10, maxWidth: maxWidth || '100%' }, children } };
  }
  const children = plainInlineText(block);

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        fontSize: 16,
        lineHeight: 1.6,
        color: theme.colors.text,
        fontFamily: theme.fonts.body.name || 'Inter',
        marginBottom: 10,
        maxWidth: maxWidth || '100%',
      },
      children,
    },
  };
}

async function renderCodeBlock(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const content = block.content || '';
  const language = block.language;
  const fontFamily = theme.fonts.code.name || 'JetBrains Mono';

  // Try to use Shiki for syntax highlighting
  let lines: any[];
  try {
    const tokens = await tokenizeCode(content, language, themeMode);
    lines = tokens.map((lineTokens, i) => {
      const lineElements = tokensToSatori(lineTokens, theme.colors.code.text);
      return {
        type: 'div',
        props: {
          key: i,
          style: {
            fontFamily,
            fontSize: 14,
            lineHeight: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
          },
          children: lineElements.length > 0 ? lineElements : [{ type: 'span', props: { children: ' ' } }],
        },
      };
    });
  } catch (error) {
    // Fallback to plain text
    const plainLines = content.split('\n');
    lines = plainLines.map((line, i) => ({
      type: 'div',
      props: {
        key: i,
        style: {
          fontFamily,
          fontSize: 14,
          lineHeight: 1.5,
          color: theme.colors.code.text,
        },
        children: line || ' ',
      },
    }));
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.code.background,
        color: theme.colors.code.text,
        fontFamily,
        fontSize: 14,
        lineHeight: 1.5,
        padding: theme.spacing.codePadding,
        borderRadius: 6,
        marginBottom: theme.spacing.gap,
        maxWidth: maxWidth || '100%',
        overflow: 'hidden',
      },
      children: lines,
    },
  };
}

function renderInlineCode(block: NormalizedBlock, theme: Theme): any {
  return {
    type: 'span',
    props: {
      style: {
        backgroundColor: theme.colors.code.background,
        color: theme.colors.code.text,
        fontFamily: theme.fonts.code.name || 'JetBrains Mono',
        fontSize: 14,
        padding: '2px 6px',
        borderRadius: 3,
      },
      children: block.content || '',
    },
  };
}

async function renderBlockquote(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const children = await Promise.all(
    (block.children || []).map((child) => renderBlock(child, theme, maxWidth, themeMode))
  );

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `4px solid ${theme.colors.blockquote.border}`,
        backgroundColor: theme.colors.blockquote.background,
        paddingLeft: theme.spacing.blockquotePadding,
        paddingTop: theme.spacing.blockquotePadding * 0.5,
        paddingBottom: theme.spacing.blockquotePadding * 0.5,
        marginBottom: theme.spacing.gap,
        color: theme.colors.blockquote.text,
        maxWidth: maxWidth || '100%',
      },
      children,
    },
  };
}

async function renderList(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const isOrdered = block.ordered || false;
  const start = block.start || 1;

  const children = await Promise.all(
    (block.children || []).map(async (item, index) => {
      const itemContent = await renderListItem(item, theme, maxWidth, themeMode);
      if (isOrdered) {
        return {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              marginBottom: 6,
            },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    marginRight: 12,
                    color: theme.colors.text,
                    fontFamily: theme.fonts.body.name || 'Inter',
                  },
                  children: `${start + index}. `,
                },
              },
              itemContent,
            ],
          },
        };
      } else {
        return {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              marginBottom: 6,
            },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    marginRight: 12,
                    color: theme.colors.text,
                    fontFamily: theme.fonts.body.name || 'Inter',
                  },
                  children: item.checked === undefined ? '• ' : item.checked ? '☑ ' : '☐ ',
                },
              },
              itemContent,
            ],
          },
        };
      }
    })
  );

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 16,
        maxWidth: maxWidth || '100%',
      },
      children,
    },
  };
}

async function renderTable(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const rows = await Promise.all((block.children || []).map(child => renderBlock(child, theme, maxWidth, themeMode)));
  return { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: maxWidth || '100%', marginBottom: theme.spacing.gap, borderRadius: 4, overflow: 'hidden' }, children: rows } };
}

async function renderListItem(block: NormalizedBlock, theme: Theme, maxWidth?: number, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const children = plainInlineText(block).replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').trim();

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        fontSize: 16,
        lineHeight: 1.6,
        color: theme.colors.text,
        fontFamily: theme.fonts.body.name || 'Inter',
        maxWidth: maxWidth ? `${maxWidth - 30}px` : '100%',
      },
      children,
    },
  };
}

function renderThematicBreak(theme: Theme, maxWidth?: number): any {
  return {
    type: 'div',
    props: {
      style: {
        height: 1,
        backgroundColor: theme.colors.blockquote.border,
        marginTop: theme.spacing.gap,
        marginBottom: theme.spacing.gap,
        maxWidth: maxWidth || '100%',
      },
    },
  };
}

async function renderStrong(block: NormalizedBlock, theme: Theme, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const children = await Promise.all(
    (block.children || []).map((child) => renderBlock(child, theme, undefined, themeMode))
  );

  return {
    type: 'span',
    props: {
      style: {
        fontWeight: 700,
        color: theme.colors.text,
      },
      children,
    },
  };
}

async function renderEmphasis(block: NormalizedBlock, theme: Theme, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const children = await Promise.all(
    (block.children || []).map((child) => renderBlock(child, theme, undefined, themeMode))
  );

  return {
    type: 'span',
    props: {
      style: {
        fontStyle: 'italic',
        color: theme.colors.text,
      },
      children,
    },
  };
}

async function renderLink(block: NormalizedBlock, theme: Theme, themeMode: 'light' | 'dark' = 'light'): Promise<any> {
  const children = await Promise.all(
    (block.children || []).map((child) => renderBlock(child, theme, undefined, themeMode))
  );

  return {
    type: 'span',
    props: {
      style: {
        color: theme.colors.link,
        textDecoration: 'underline',
      },
      children,
    },
  };
}

function renderImage(block: NormalizedBlock, theme: Theme): any {
  const src = block.url;
  if (src && /readme-typing-svg/i.test(src)) {
    const lines = new URL(src).searchParams.get('lines')?.split(';').filter(Boolean) || [];
    return { type: 'div', props: { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 750, height: 50, color: '#9D4EDD', fontSize: 22, fontWeight: 700, fontFamily: theme.fonts.code.name || 'JetBrains Mono' }, children: lines[0] || block.alt || '' } };
  }
  if (src && /^https?:\/\//i.test(src)) {
    const alt = block.alt || '';
    const width = /typing-svg/i.test(src) ? 750 : /shields\.io|komarev\.com/i.test(src) ? 190 : /skillicons\.dev/i.test(src) ? 520 : 760;
    const height = /typing-svg/i.test(src) ? 50 : /shields\.io|komarev\.com/i.test(src) ? 28 : /skillicons\.dev/i.test(src) ? 64 : 195;
    return { type: 'img', props: { src, width, height, alt, style: { objectFit: 'contain', maxWidth: '100%' } } };
  }
  return {
    type: 'span',
    props: {
      style: {
        color: theme.colors.link,
        fontStyle: 'italic',
      },
      children: `[Image: ${block.alt || block.url || 'image'}]`,
    },
  };
}

function getHeadingSize(level: number): number {
  const sizes: Record<number, number> = {
    1: 32,
    2: 24,
    3: 20,
    4: 16,
    5: 14,
    6: 13,
  };
  return sizes[level] || 16;
}
