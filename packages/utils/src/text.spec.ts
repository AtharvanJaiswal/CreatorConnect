import { describe, it, expect } from 'vitest';
import { slugify, sanitizeText } from './text.js';

describe('text utilities', () => {
  it('converts title strings to clean URL slugs', () => {
    expect(slugify('4K Video Editing & Color Grading!')).toBe('4k-video-editing-color-grading');
    expect(slugify('  Tech Showcase 2026   ')).toBe('tech-showcase-2026');
  });

  it('strips non-printable ASCII control characters', () => {
    expect(sanitizeText('Hello\u0000World\u0007!')).toBe('HelloWorld!');
  });
});
