/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PANEL_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
