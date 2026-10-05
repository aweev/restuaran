declare module "workbox-webpack-plugin" {
  import type { WebpackPluginInstance } from "webpack";

  interface GenerateSWOptions {
    swSrc?: string;
    swDest?: string;
    cleanupOutdatedCaches?: boolean;
    clientsClaim?: boolean;
    skipWaiting?: boolean;
    maximumFileSizeToCacheInBytes?: number;
    [key: string]: unknown;
  }

  export class GenerateSW implements WebpackPluginInstance {
    constructor(options?: GenerateSWOptions);
    apply(compiler: unknown): void;
  }
}
