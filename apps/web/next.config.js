/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crm/shared'],
  async rewrites() {
    // Only rewrite to an external API if API_URL is explicitly configured
    if (process.env.API_URL) {
      return [
        {
          source: '/api/v1/:path*',
          destination: `${process.env.API_URL.replace(/\/$/, '')}/api/v1/:path*`,
        },
      ];
    }
    return [];
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
