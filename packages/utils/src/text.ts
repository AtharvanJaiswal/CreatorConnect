/**
 * Text sanitization and URL slugification utilities.
 */

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function sanitizeText(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '').trim();
}
