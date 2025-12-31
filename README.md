# @lollopanta/mdtoimage

A production-ready Node.js library that converts Markdown files or strings into beautiful SVG and PNG images using **Satori** and **Sharp**. No browser required! 🚀

## Features

- ⚡ **Fast & Server-Side**: No Puppeteer, Playwright, or browser dependencies
- 🎨 **Full Theme Support**: Built-in light/dark themes with complete customization
- 🔤 **Custom Fonts**: Load and embed your own fonts (TTF, OTF)
- 💧 **Watermark System**: Default watermark (removable) for attribution
- 🎯 **Syntax Highlighting**: Powered by Shiki for beautiful code blocks
- 📦 **Multiple Formats**: Export as PNG, SVG, or base64
- 🖥️ **CLI Tool**: Command-line interface for quick conversions
- 📝 **GitHub Flavored Markdown**: Full GFM support

## Installation

```bash
npm install @lollopanta/mdtoimage
```

## Quick Start

### Programmatic API

```js
import { renderMarkdownToImage } from '@lollopanta/mdtoimage';

await renderMarkdownToImage({
  input: 'README.md', // or markdown string
  output: 'output.png',
  width: 1200,
  theme: 'dark',
  fonts: {
    body: './fonts/Inter-Regular.ttf',
    code: './fonts/JetBrainsMono-Regular.ttf'
  },
  watermark: true // default behavior
});
```

### CLI

```bash
# Basic usage
mdtoimage README.md -o out.png

# With options
mdtoimage README.md -o out.png --theme dark --width 1200

# Disable watermark
mdtoimage README.md -o out.png --no-watermark

# Custom watermark
mdtoimage README.md -o out.png --watermark-text "My Custom Text" --watermark-opacity 0.5

# Export as SVG
mdtoimage README.md -o out.svg --format svg

# With custom fonts
mdtoimage README.md -o out.png \
  --font-body ./fonts/Inter-Regular.ttf \
  --font-heading ./fonts/Inter-Bold.ttf \
  --font-code ./fonts/JetBrainsMono-Regular.ttf
```

## API Reference

### `renderMarkdownToImage(options)`

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `input` | `string` | **required** | Markdown file path or markdown string |
| `output` | `string` | - | Output file path (optional for base64/SVG) |
| `width` | `number` | `1200` | Image width in pixels |
| `height` | `number` | `auto` | Image height (auto-calculated if not provided) |
| `format` | `'png' \| 'svg' \| 'base64'` | `'png'` | Output format |
| `theme` | `'light' \| 'dark' \| Theme` | `'light'` | Theme preset or custom theme object |
| `maxWidth` | `number` | `width - padding * 2` | Max content width for responsive layout |
| `fonts` | `object` | - | Custom font paths/configs |
| `watermark` | `boolean \| WatermarkConfig` | `true` | Watermark configuration |

#### Fonts

```ts
fonts?: {
  body?: string | FontConfig;
  heading?: string | FontConfig;
  code?: string | FontConfig;
}
```

#### Watermark

```ts
watermark?: false | {
  enabled?: boolean;      // default: true
  text?: string;          // default: "Generated with @lollopanta/mdtoimage"
  opacity?: number;       // default: 0.3
  fontSize?: number;      // default: 12
  padding?: number;       // default: 16
  color?: string;         // default: theme text color
}
```

#### Return Value

```ts
{
  buffer?: Buffer;    // PNG buffer (if format is 'png')
  svg?: string;      // SVG string (if format is 'svg')
  base64?: string;   // Base64 string (if format is 'base64')
  width: number;
  height: number;
}
```

## Custom Themes

```js
import { renderMarkdownToImage, lightTheme } from '@lollopanta/mdtoimage';

const customTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    background: '#f5f5f5',
    text: '#333333',
    heading: {
      1: '#000000',
      2: '#111111',
      3: '#222222',
      4: '#333333',
      5: '#444444',
      6: '#555555',
    },
  },
  spacing: {
    padding: 50,
    gap: 30,
    blockquotePadding: 24,
    codePadding: 20,
  },
};

await renderMarkdownToImage({
  input: 'README.md',
  output: 'output.png',
  theme: customTheme,
});
```

## Supported Markdown Features

- Headings (h1-h6)
- Paragraphs
- Inline code and code blocks
- Blockquotes
- Ordered and unordered lists
- Task lists (GFM)
- Bold and italic text
- Links
- Horizontal rules
- Syntax highlighting (via Shiki)

## Examples

### Basic Example

```js
import { renderMarkdownToImage } from '@lollopanta/mdtoimage';

const result = await renderMarkdownToImage({
  input: '# Hello World\n\nThis is **markdown** converted to an image!',
  output: 'hello.png',
  width: 800,
  theme: 'light',
});
```

### Base64 Output

```js
const result = await renderMarkdownToImage({
  input: '# My Document',
  format: 'base64',
  width: 1200,
});

console.log(result.base64); // Base64 encoded PNG
```

### SVG Output

```js
const result = await renderMarkdownToImage({
  input: 'README.md',
  format: 'svg',
  width: 1200,
});

// result.svg contains the SVG string
```

## Architecture

```
Markdown
  → Markdown AST (remark)
  → Normalized block tree
  → JSX component tree
  → SVG (Satori)
  → PNG (Sharp)
```

## Requirements

- Node.js >= 18.0.0
- TypeScript (for development)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
