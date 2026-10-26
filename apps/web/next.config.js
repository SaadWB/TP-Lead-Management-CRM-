/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crm/shared'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000'}/api/v1/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/telecaller/tasks',
        destination: '/telecaller/today',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
