const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@cmgym/core', '@cmgym/ui'],
  // Required for monorepo standalone builds — traces deps from the repo root
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
};

module.exports = nextConfig;
