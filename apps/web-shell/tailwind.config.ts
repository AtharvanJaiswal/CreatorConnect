import type { Config } from 'tailwindcss';
import { creatorConnectPreset } from '@creatorconnect/design-system/tailwind-preset';

const config: Config = {
  presets: [creatorConnectPreset as Config],
  content: ['./src/**/*.{ts,tsx,mdx}', '../../packages/ui/src/**/*.{ts,tsx}'],
};

export default config;
