/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  readonly VITE_PUBLIC_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
