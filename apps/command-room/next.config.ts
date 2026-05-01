import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@docket/ui', '@docket/shared', '@docket/db'],
  // @docket/db uses ESM-style imports with .js extensions (Node strict ESM
  // requirement). Tell Next.js webpack to resolve .js to .ts so workspace
  // packages can be transpiled from source.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };
    return config;
  },
};

export default config;
