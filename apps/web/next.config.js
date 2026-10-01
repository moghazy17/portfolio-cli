/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ahmed-moghazy/shared'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }];
  },
};

module.exports = nextConfig;
