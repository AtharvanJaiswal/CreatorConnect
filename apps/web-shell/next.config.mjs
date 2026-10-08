/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@creatorconnect/utils',
    '@creatorconnect/validation',
    '@creatorconnect/contracts',
    '@creatorconnect/design-system',
    '@creatorconnect/ui',
  ],
  poweredByHeader: false,
  async rewrites() {
    const apiUrl = (
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
