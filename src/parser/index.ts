/**
 * Markdown parsing and AST normalization
 */

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import type { Root, Node } from 'mdast';

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
}

/**
 * Parse markdown string to AST
 */
export async function parseMarkdown(markdown: string): Promise<Root> {
  const processor = remark().use(remarkGfm);
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
      // Skip HTML nodes for now
      break;
    }

    default:
      // Unknown node type, skip
      break;
  }

  return blocks;
}

function normalizeInlineContent(nodes: Node[]): NormalizedBlock[] {
  const result: NormalizedBlock[] = [];
  let currentText = '';
  let currentEmphasis: 'strong' | 'emphasis' | null = null;

  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        const text = node as any;
        currentText += text.value;
        break;
      }

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
