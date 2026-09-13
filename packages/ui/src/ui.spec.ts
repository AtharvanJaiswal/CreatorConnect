import { describe, expect, it } from 'vitest';
import { cn } from './lib/utils.js';
import { buttonVariants } from './components/button.js';
import { badgeVariants } from './components/badge.js';

describe('@creatorconnect/ui', () => {
  it('should merge tailwind classes properly using cn()', () => {
    const result = cn('px-2 py-1', 'px-4', { 'bg-red-500': true, 'bg-blue-500': false });
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
    expect(result).toContain('bg-red-500');
  });

  it('should generate correct classes from buttonVariants', () => {
    const defaultClasses = buttonVariants();
    expect(defaultClasses).toContain('bg-primary');

    const destructiveClasses = buttonVariants({ variant: 'destructive', size: 'sm' });
    expect(destructiveClasses).toContain('bg-destructive');
    expect(destructiveClasses).toContain('h-9');

    const glassClasses = buttonVariants({ variant: 'glass' });
    expect(glassClasses).toContain('glass');
  });

  it('should generate correct classes from badgeVariants', () => {
    const successBadge = badgeVariants({ variant: 'success' });
    expect(successBadge).toContain('bg-success');

    const warningBadge = badgeVariants({ variant: 'warning' });
    expect(warningBadge).toContain('bg-warning');
  });
});
