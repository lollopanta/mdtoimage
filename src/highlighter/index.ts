/**
 * Shiki syntax highlighting integration
 */

import { getHighlighter, type Highlighter, type IThemedToken } from 'shiki';

let highlighterLight: Highlighter | null = null;
let highlighterDark: Highlighter | null = null;

/**
 * Initialize Shiki highlighter
 */
export async function initHighlighter(theme: 'light' | 'dark' = 'light'): Promise<Highlighter> {
  if (theme === 'light') {
    if (!highlighterLight) {
      highlighterLight = await getHighlighter({
        themes: ['github-light'],
        langs: ['javascript', 'typescript', 'jsx', 'tsx', 'json', 'python', 'bash', 'shell', 'html', 'css', 'markdown', 'yaml', 'toml', 'go', 'rust', 'java', 'c', 'cpp'],
      });
    }
    return highlighterLight;
  } else {
    if (!highlighterDark) {
      highlighterDark = await getHighlighter({
        themes: ['github-dark'],
        langs: ['javascript', 'typescript', 'jsx', 'tsx', 'json', 'python', 'bash', 'shell', 'html', 'css', 'markdown', 'yaml', 'toml', 'go', 'rust', 'java', 'c', 'cpp'],
      });
    }
    return highlighterDark;
  }
}

/**
 * Tokenize code with Shiki and return tokens with colors
 */
export async function tokenizeCode(
  code: string,
  language: string | undefined,
  theme: 'light' | 'dark' = 'light'
): Promise<IThemedToken[][]> {
  if (!language) {
    // Return plain text tokens
    return code.split('\n').map(line => [{ content: line, color: undefined }]);
  }

  try {
    const hl = await initHighlighter(theme);
    const themeName = theme === 'light' ? 'github-light' : 'github-dark';
    const tokens = hl.codeToTokens(code, {
      lang: language,
      theme: themeName,
    });
    
    return tokens;
  } catch (error) {
    // If language is not supported, return plain text
    return code.split('\n').map(line => [{ content: line, color: undefined }]);
  }
}

/**
 * Convert Shiki tokens to Satori-compatible JSX elements
 */
export function tokensToSatori(tokens: IThemedToken[], defaultColor: string): any[] {
  return tokens.map((token, i) => {
    const props: any = {
      children: token.content,
    };
    
    if (token.color) {
      props.style = {
        color: token.color,
      };
    } else {
      props.style = {
        color: defaultColor,
      };
    }
    
    return {
      type: 'span',
      props,
    };
  });
}
