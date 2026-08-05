/// <reference types="vite/client" />

// Image assets
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.gif" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.svg?url" {
  const src: string;
  export default src;
}

// Video assets
declare module "*.mp4" {
  const src: string;
  export default src;
}

// Lottie JSON animations
declare module "*.json" {
  const value: unknown;
  export default value;
}

declare global {
  interface ImportMetaEnv {}

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
