/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@creatorconnect/utils',
    '@creatorconnect/validation',
    '@creatorconnect/contracts'
  ],
  poweredByHeader: false
};

export default nextConfig;
