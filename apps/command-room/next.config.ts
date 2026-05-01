import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

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

export default withSentryConfig(config, {
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
});
