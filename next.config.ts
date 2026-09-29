import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Constrain build parallelism. This project is developed on 4GB machines where
  // Next's default multi-worker compile exhausts the heap.
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
