import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};
export default config;
