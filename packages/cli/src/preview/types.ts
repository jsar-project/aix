export type PreviewEmbeddedFile = {
  path: string;
  base64: string;
};

export type PreviewSourceKind = "aix-file" | "directory";

export type PreviewState = {
  appId: string;
  sourceName: string;
  sourceKind: PreviewSourceKind;
  title?: string;
  version?: string;
  files: PreviewEmbeddedFile[];
};

export type PreviewHtmlConfig = {
  mode: "static" | "dev";
  sourceLabel: string;
  inkRuntimeVersion: string;
  inkImportMap: {
    imports: Record<string, string>;
  };
  title?: string;
  version?: string;
  fileCount?: number;
  initialState?: PreviewState;
  statePath?: string;
};

export type DevPreviewMessage =
  | { type: "reload"; revision: number }
  | { type: "error"; revision: number; message: string };

export type PreviewServer = {
  url: string;
  close: () => void;
};
