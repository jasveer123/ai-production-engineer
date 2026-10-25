// Plain JavaScript so the production image does not need TypeScript to read it.
// Client-rendered pages talk to the API with the session cookie; nothing is prerendered with data.
/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  transpilePackages: ['@ape/api-contracts'],
};

export default nextConfig;
