import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@docket/ui', '@docket/shared', '@docket/db'],
  // @docket/db uses ESM .js extensions in internal imports (Node strict ESM
  // requirement). Tell webpack to resolve .js to .ts so transpilePackages
  // can compile from source.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };
    return config;
  },
};

// Wrap with Sentry's build-time instrumentation. Source map upload + auto
// route instrumentation. Uploads only run when SENTRY_AUTH_TOKEN is set,
// so PR previews without the secret silently skip.
export default withSentryConfig(config, {
  silent: !process.env.CI,
  // Source map upload is gated on auth token presence — gracefully skips
  // when not provided.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Hide source maps from being publicly accessible after upload.
  hideSourceMaps: true,
  disableLogger: true,
});
