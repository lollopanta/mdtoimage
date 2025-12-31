#!/usr/bin/env node

/**
 * CLI tool for md-to-image
 */

import { Command } from 'commander';
import { renderMarkdownToImage } from '../renderer/index.js';
import { readFileSync, writeFileSync } from 'fs';

const program = new Command();

program
  .name('md-to-image')
  .description('Convert Markdown files to images')
  .version('1.0.0')
  .argument('<input>', 'Input Markdown file or string')
  .option('-o, --output <path>', 'Output file path', 'output.png')
  .option('-w, --width <number>', 'Image width in pixels', '1200')
  .option('--height <number>', 'Image height in pixels (auto-calculated if not provided)')
  .option('-t, --theme <theme>', 'Theme: light or dark', 'light')
  .option('--max-width <number>', 'Max content width for responsive layout')
  .option('--format <format>', 'Output format: png, svg, or base64', 'png')
  .option('--no-watermark', 'Disable watermark')
  .option('--watermark-text <text>', 'Custom watermark text')
  .option('--watermark-opacity <number>', 'Watermark opacity (0-1)', '0.3')
  .option('--font-body <path>', 'Path to body font file')
  .option('--font-heading <path>', 'Path to heading font file')
  .option('--font-code <path>', 'Path to code font file')
  .action(async (input: string, options: any) => {
    try {
      const renderOptions: any = {
        input,
        output: options.output,
        width: parseInt(options.width, 10),
        format: options.format,
        theme: options.theme,
      };

      if (options.height) {
        renderOptions.height = parseInt(options.height, 10);
      }

      if (options.maxWidth) {
        renderOptions.maxWidth = parseInt(options.maxWidth, 10);
      }

      // Watermark configuration
      if (options.watermark === false) {
        renderOptions.watermark = false;
      } else {
        const watermark: any = {};
        if (options.watermarkText) {
          watermark.text = options.watermarkText;
        }
        if (options.watermarkOpacity) {
          watermark.opacity = parseFloat(options.watermarkOpacity);
        }
        if (Object.keys(watermark).length > 0) {
          renderOptions.watermark = watermark;
        }
      }

      // Font configuration
      const fonts: any = {};
      if (options.fontBody) {
        fonts.body = options.fontBody;
      }
      if (options.fontHeading) {
        fonts.heading = options.fontHeading;
      }
      if (options.fontCode) {
        fonts.code = options.fontCode;
      }
      if (Object.keys(fonts).length > 0) {
        renderOptions.fonts = fonts;
      }

      const result = await renderMarkdownToImage(renderOptions);

      if (options.format === 'base64') {
        console.log(result.base64);
      } else if (options.format === 'svg' && result.svg) {
        if (options.output) {
          writeFileSync(options.output, result.svg);
          console.log(`SVG saved to ${options.output}`);
        } else {
          console.log(result.svg);
        }
      } else {
        console.log(`Image saved to ${options.output} (${result.width}x${result.height})`);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
