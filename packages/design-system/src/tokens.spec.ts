import { describe, expect, it } from 'vitest';
import { colors, radii, shadows, typography } from './tokens.js';
import { creatorConnectPreset } from './tailwind-preset.js';

describe('CreatorConnect Design Tokens', () => {
  it('should define light and dark color palettes with all required semantic keys', () => {
    const requiredKeys = [
      'background',
      'foreground',
      'card',
      'popover',
      'primary',
      'secondary',
      'muted',
      'accent',
      'destructive',
      'success',
      'warning',
      'border',
      'input',
      'ring',
    ];

    for (const key of requiredKeys) {
      expect(colors.light).toHaveProperty(key);
      expect(colors.dark).toHaveProperty(key);
    }
  });

  it('should define radii scales', () => {
    expect(radii.md).toBe('0.5rem');
    expect(radii.full).toBe('9999px');
  });

  it('should define typography with modern font stacks', () => {
    expect(typography.fontFamily.sans).toContain('Inter');
    expect(typography.fontFamily.heading).toContain('Outfit');
  });

  it('should export a valid Tailwind CSS preset', () => {
    expect(creatorConnectPreset.darkMode).toEqual(['class']);
    expect(creatorConnectPreset.theme?.extend?.colors).toHaveProperty('primary');
  });
});
