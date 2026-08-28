/// <reference types="vite/client" />

// Vite `?raw` imports (used by the System Journal page to bundle BUILD_LOG.md).
declare module "*?raw" {
  const content: string;
  export default content;
}
