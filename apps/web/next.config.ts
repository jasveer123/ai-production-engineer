import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      "*.svg": {
        loaders: [
          {
            loader: "@svgr/webpack",
            options: { icon: false, svgo: false, titleProp: true },
          },
        ],
        as: "*.js",
      },
    },
  },
}

export default nextConfig
