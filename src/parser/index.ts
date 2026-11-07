/**
 * Markdown parsing and AST normalization
 */

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import type { Root, Node } from 'mdast';
import { parseDocument } from 'htmlparser2';
import type { Element, Node as HtmlNode } from 'domhandler';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

export interface NormalizedBlock {
  type: string;
  content?: string;
  children?: NormalizedBlock[];
  level?: number; // For headings
  ordered?: boolean; // For lists
  start?: number; // For ordered lists
  language?: string; // For code blocks
  url?: string; // For links
  title?: string; // For links/images
  alt?: string; // For images
  checked?: boolean; // For task lists
  depth?: number; // For list items
  attributes?: Record<string, string>;
}

/**
 * Parse markdown string to AST
 */
export async function parseMarkdown(markdown: string, mdx = false): Promise<Root> {
  if (!mdx) {
    const html = micromark(markdown, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
    return { type: 'root', children: [{ type: 'html', value: html }] } as unknown as Root;
  }
  const processor = remark().use(remarkGfm).use(remarkMdx);
  const tree = await processor.parse(markdown);
  return tree;
}

/**
 * Normalize AST to a simpler block tree structure
 */
export function normalizeAST(node: Node): NormalizedBlock[] {
  const blocks: NormalizedBlock[] = [];

  if (node.type === 'root') {
    const root = node as Root;
    for (const child of root.children) {
      blocks.push(...normalizeNode(child));
    }
  } else {
    blocks.push(...normalizeNode(node));
  }

  return blocks;
}

function normalizeNode(node: Node): NormalizedBlock[] {
  const blocks: NormalizedBlock[] = [];

  switch (node.type) {
    case 'heading': {
      const heading = node as any;
      blocks.push({
        type: 'heading',
        level: heading.depth,
        children: normalizeInlineContent(heading.children || []),
      });
      break;
    }

    case 'paragraph': {
      const paragraph = node as any;
      blocks.push({
        type: 'paragraph',
        children: normalizeInlineContent(paragraph.children || []),
      });
      break;
    }

    case 'code': {
      const code = node as any;
      blocks.push({
        type: 'code',
        content: code.value,
        language: code.lang || undefined,
      });
      break;
    }

    case 'blockquote': {
      const blockquote = node as any;
      blocks.push({
        type: 'blockquote',
        children: normalizeAST({ type: 'root', children: blockquote.children || [] } as Root),
      });
      break;
    }

    case 'list': {
      const list = node as any;
      blocks.push({
        type: 'list',
        ordered: list.ordered || false,
        start: list.start || 1,
        children: (list.children || []).map((item: any) => ({
          type: 'listItem',
          depth: item.depth || 0,
          checked: item.checked,
          children: normalizeAST({ type: 'root', children: item.children || [] } as Root),
        })),
      });
      break;
    }

    case 'thematicBreak': {
      blocks.push({ type: 'thematicBreak' });
      break;
    }

    case 'html': {
      const html = node as any;
      blocks.push(...normalizeHtml(String(html.value || '')));
      break;
    }

    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement': {
      const jsx = node as any;
      const children = normalizeAST({ type: 'root', children: jsx.children || [] } as Root);
      blocks.push({ type: jsx.name === 'br' ? 'htmlBreak' : 'htmlElement', content: jsx.name || 'div', children });
      break;
    }
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
    case 'mdxjsEsm':
      // Expressions, imports, and exports are intentionally not evaluated.
      break;

    default:
      // Unknown node type, skip
      break;
  }

  return blocks;
}

function normalizeHtml(raw: string): NormalizedBlock[] {
  return normalizeHtmlChildren(parseDocument(raw).children);
}

function normalizeHtmlChildren(nodes: HtmlNode[]): NormalizedBlock[] {
  return nodes.flatMap((node) => {
    if ('data' in node && typeof node.data === 'string') {
      const value = node.data.replace(/\s+/g, ' ');
      return value.trim() ? [{ type: 'text', content: value }] : [];
    }
    if (!('name' in node)) return [];
    const element = node as Element;
    const tag = element.name.toLowerCase();
    const attrs = element.attribs || {};
    const children = normalizeHtmlChildren(element.children);
    if (tag === 'pre') {
      const code = element.children.find(child => child.type === 'tag' && child.name === 'code') as Element | undefined;
      const value = code ? code.children.map(child => 'data' in child ? child.data : '').join('') : element.children.map(child => 'data' in child ? child.data : '').join('');
      const language = code?.attribs.class?.match(/(?:^|\s)language-([\w+-]+)/)?.[1];
      return [{ type: 'code', content: value.replace(/\n$/, ''), language }];
    }
    if (tag === 'img') return [{ type: 'image', url: attrs.src, alt: attrs.alt || '', attributes: attrs }];
    if (tag === 'br') return [{ type: 'htmlBreak' }];
    if (tag === 'hr') return [{ type: 'thematicBreak' }];
    if (/^h[1-6]$/.test(tag)) return [{ type: 'heading', level: Number(tag[1]), children }];
    if (tag === 'p') return [{ type: 'paragraph', children }];
    if (tag === 'blockquote') return [{ type: 'blockquote', children }];
    if (tag === 'table') return [{ type: 'table', children }];
    if (tag === 'thead' || tag === 'tbody') return children;
    if (tag === 'tr') return [{ type: 'tableRow', children }];
    if (tag === 'th' || tag === 'td') return [{ type: 'tableCell', content: tag, children }];
    if (tag === 'a') return [{ type: 'link', url: attrs.href, title: attrs.title, children }];
    if (tag === 'strong' || tag === 'b') return [{ type: 'strong', children }];
    if (tag === 'em' || tag === 'i') return [{ type: 'emphasis', children }];
    if (tag === 'del' || tag === 's' || tag === 'strike') return [{ type: 'delete', children }];
    if (tag === 'code') return [{ type: 'inlineCode', content: children.map(child => child.content || '').join('') }];
    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'svg') return [];
    if (['ul', 'ol'].includes(tag)) return [{ type: 'list', ordered: tag === 'ol', children: children.filter(child => child.type === 'listItem') }];
    if (tag === 'li') {
      const checkbox = element.children.find(child => child.type === 'tag' && child.name === 'input' && child.attribs.type === 'checkbox') as Element | undefined;
      const cleanChildren = checkbox ? children.filter(child => child.type !== 'htmlElement') : children;
      return [{ type: 'listItem', checked: checkbox ? 'checked' in checkbox.attribs : undefined, children: cleanChildren }];
    }
    return children.length ? [{ type: 'htmlElement', content: tag, attributes: attrs, children }] : [];
  });
}

function normalizeInlineContent(nodes: Node[]): NormalizedBlock[] {
  const result: NormalizedBlock[] = [];
  let currentText = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        const text = node as any;
        currentText += text.value;
        break;
      }

      case 'html': {
        if (currentText) { result.push({ type: 'text', content: currentText }); currentText = ''; }
        result.push(...normalizeHtml(String((node as any).value || '')));
        break;
      }

      case 'mdxJsxTextElement': {
        if (currentText) { result.push({ type: 'text', content: currentText }); currentText = ''; }
        const jsx = node as any;
        result.push({ type: jsx.name === 'br' ? 'htmlBreak' : 'htmlElement', content: jsx.name || 'span', children: normalizeInlineContent(jsx.children || []) });
        break;
      }
      case 'mdxTextExpression':
        // Never execute embedded JavaScript.
        break;

      case 'inlineCode': {
        if (currentText) {
          result.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const code = node as any;
        result.push({ type: 'inlineCode', content: code.value });
        break;
      }

      case 'strong': {
        if (currentText) {
          result.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const strong = node as any;
        const children = normalizeInlineContent(strong.children || []);
        result.push({ type: 'strong', children });
        break;
      }

      case 'emphasis': {
        if (currentText) {
          result.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const emphasis = node as any;
        const children = normalizeInlineContent(emphasis.children || []);
        result.push({ type: 'emphasis', children });
        break;
      }

      case 'link': {
        if (currentText) {
          result.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const link = node as any;
        const children = normalizeInlineContent(link.children || []);
        result.push({
          type: 'link',
          url: link.url,
          title: link.title,
          children,
        });
        break;
      }

      case 'image': {
        if (currentText) {
          result.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const image = node as any;
        result.push({
          type: 'image',
          url: image.url,
          alt: image.alt,
          title: image.title,
        });
        break;
      }

      case 'break': {
        currentText += '\n';
        break;
      }

      case 'delete': {
        if (currentText) {
          result.push({ type: 'text', content: currentText });
          currentText = '';
        }
        result.push({ type: 'delete', children: normalizeInlineContent((node as any).children || []) });
        break;
      }

      case 'linkReference':
      case 'imageReference': {
        const reference = node as any;
        if (currentText) {
          result.push({ type: 'text', content: currentText });
          currentText = '';
        }
        result.push({ type: node.type === 'linkReference' ? 'link' : 'image', url: reference.identifier, alt: reference.label, children: normalizeInlineContent(reference.children || []) });
        break;
      }

      default:
        // Unknown inline type
        break;
    }
  }

  if (currentText) {
    result.push({ type: 'text', content: currentText });
  }

  return result;
}
