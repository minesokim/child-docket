import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@docket/ui', '@docket/shared'],
};

export default config;
