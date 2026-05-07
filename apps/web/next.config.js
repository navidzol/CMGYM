/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@fitflow/core', '@fitflow/ui'],
};

module.exports = nextConfig;
