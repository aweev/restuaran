import type { NextConfig } from "next"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { InjectManifest } = require("workbox-webpack-plugin") as {
  InjectManifest: new (opts: Record<string, unknown>) => unknown
}

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "@radix-ui/react-icons"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
  webpack(config, { isServer, dev }) {
    if (!isServer && !dev) {
      config.plugins.push(
        new InjectManifest({
          swSrc: "./public/sw.js",
          swDest: "sw.js",
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        })
      )
    }
    return config
  },
}

export default nextConfig
