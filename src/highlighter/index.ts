/**
 * Shiki syntax highlighting integration
 */

import { createHighlighter, type Highlighter, type ThemedToken } from 'shiki';

let highlighterLight: Highlighter | null = null;
let highlighterDark: Highlighter | null = null;
let highlighterLightPromise: Promise<Highlighter> | null = null;
let highlighterDarkPromise: Promise<Highlighter> | null = null;

/**
 * Initialize Shiki highlighter (singleton pattern with promise caching to prevent parallel creation)
 */
export async function initHighlighter(theme: 'light' | 'dark' = 'light'): Promise<Highlighter> {
  if (theme === 'light') {
    if (highlighterLight) {
      return highlighterLight;
    }
    if (!highlighterLightPromise) {
      highlighterLightPromise = createHighlighter({
        themes: ['github-light'],
        langs: ['javascript', 'typescript', 'jsx', 'tsx', 'json', 'python', 'bash', 'shell', 'html', 'css', 'markdown', 'yaml', 'toml', 'go', 'rust', 'java', 'c', 'cpp'],
      }).then(hl => {
        highlighterLight = hl;
        return hl;
      });
    }
    return highlighterLightPromise;
  } else {
    if (highlighterDark) {
      return highlighterDark;
    }
    if (!highlighterDarkPromise) {
      highlighterDarkPromise = createHighlighter({
        themes: ['github-dark'],
        langs: ['javascript', 'typescript', 'jsx', 'tsx', 'json', 'python', 'bash', 'shell', 'html', 'css', 'markdown', 'yaml', 'toml', 'go', 'rust', 'java', 'c', 'cpp'],
      }).then(hl => {
        highlighterDark = hl;
        return hl;
      });
    }
    return highlighterDarkPromise;
  }
}

/**
 * Tokenize code with Shiki and return tokens with colors
 */
export async function tokenizeCode(
  code: string,
  language: string | undefined,
  theme: 'light' | 'dark' = 'light'
): Promise<ThemedToken[][]> {
  if (!language) {
    // Return plain text tokens
    return code.split('\n').map(line => [{ content: line, color: undefined }] as ThemedToken[]);
  }

  try {
    const hl = await initHighlighter(theme);
    const themeName = theme === 'light' ? 'github-light' : 'github-dark';
    const result = hl.codeToTokens(code, {
      lang: language as any,
      theme: themeName,
    });
    
    // codeToTokens returns TokensResult which has a tokens property
    // Check if result has tokens property, otherwise assume it's the array directly
    if (result && typeof result === 'object' && 'tokens' in result) {
      return (result as any).tokens as ThemedToken[][];
    }
    return result as unknown as ThemedToken[][];
  } catch (error) {
    // If language is not supported, return plain text
    return code.split('\n').map(line => [{ content: line, color: undefined }] as ThemedToken[]);
  }
}

/**
 * Convert Shiki tokens to Satori-compatible JSX elements
 */
export function tokensToSatori(tokens: ThemedToken[], defaultColor: string): any[] {
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
