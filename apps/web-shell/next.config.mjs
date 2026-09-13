/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@creatorconnect/utils',
    '@creatorconnect/validation',
    '@creatorconnect/contracts',
    '@creatorconnect/design-system',
    '@creatorconnect/ui'
  ],
  poweredByHeader: false
};

export default nextConfig;
