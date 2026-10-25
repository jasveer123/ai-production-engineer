import type { NextConfig } from 'next';

// Client-rendered pages talk to the API with the session cookie; nothing is prerendered with data.
const nextConfig: NextConfig = {
  trailingSlash: true,
  transpilePackages: ['@ape/api-contracts'],
};

export default nextConfig;
