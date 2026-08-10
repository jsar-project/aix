import {
  DEV_WS_PATH,
  INK_SDK_URL,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
} from "./constants";
import type { PreviewHtmlConfig } from "./types";

export function renderPreviewHtml(config: PreviewHtmlConfig): string {
  const title = config.title?.trim() || config.sourceLabel;
  const versionLabel = config.version?.trim() || "Unknown";
  const runtimeConfig = serializeForInlineScript({
    mode: config.mode,
    inkSdkUrl: INK_SDK_URL,
    statePath: config.statePath,
    initialState: config.initialState,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} - AIX Preview</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f5f7;
        color: #111827;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 30%),
          linear-gradient(180deg, #f9fafb 0%, #eef2ff 100%);
      }

      .page {
        width: min(1120px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 32px 0 48px;
      }

      .hero {
        margin-bottom: 24px;
      }

      .eyebrow {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #4f46e5;
      }

      h1 {
        margin: 0;
        font-size: clamp(28px, 5vw, 42px);
        line-height: 1.02;
        letter-spacing: -0.04em;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 14px;
        color: #4b5563;
        font-size: 14px;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(280px, 1fr) minmax(320px, 420px);
        gap: 24px;
        align-items: stretch;
      }

      .card {
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.72);
        border-radius: 24px;
        box-shadow: 0 18px 56px rgba(15, 23, 42, 0.1);
        backdrop-filter: blur(18px);
        min-height: 100%;
        align-self: stretch;
      }

      .preview-card {
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .preview-shell {
        width: ${PREVIEW_WIDTH}px;
        margin: 0 auto;
        padding: 0;
        border-radius: 28px;
        background: linear-gradient(180deg, #111827 0%, #030712 100%);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      }

      .canvas-frame {
        overflow: hidden;
        border-radius: 22px;
        background: #ffffff;
        width: ${PREVIEW_WIDTH}px;
        height: ${PREVIEW_HEIGHT}px;
      }

      canvas {
        display: block;
        width: ${PREVIEW_WIDTH}px;
        height: ${PREVIEW_HEIGHT}px;
        outline: none;
        background: #ffffff;
      }

      .sidebar {
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 24px;
      }

      .status {
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.06);
        border: 1px solid rgba(148, 163, 184, 0.2);
        color: #475569;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .status[data-tone="error"] {
        background: rgba(127, 29, 29, 0.1);
        border-color: rgba(185, 28, 28, 0.16);
        color: #991b1b;
      }

      .controls-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 0 0;
      }

      .controls-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        width: min(100%, 274px);
        justify-items: center;
      }

      .control-button {
        appearance: none;
        border: 1px solid rgba(191, 219, 254, 0.78);
        border-radius: 28px;
        width: 100%;
        max-width: 132px;
        aspect-ratio: 1 / 1;
        min-height: 0;
        background: rgba(255, 255, 255, 0.9);
        color: #334155;
        font-size: 28px;
        font-weight: 600;
        line-height: 1;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          0 10px 24px rgba(148, 163, 184, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.55);
        cursor: pointer;
        user-select: none;
        transition:
          transform 120ms ease,
          box-shadow 120ms ease,
          border-color 120ms ease,
          background-color 120ms ease;
      }

      .control-button[data-role="tap"] {
        background: #0f172a;
        color: #f8fafc;
        border-color: rgba(15, 23, 42, 0.92);
        font-size: 20px;
        line-height: 1.2;
        box-shadow:
          0 12px 28px rgba(15, 23, 42, 0.22),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .control-button:hover {
        border-color: rgba(96, 165, 250, 0.52);
      }

      .control-button:active,
      .control-button.is-pressed {
        transform: translateY(2px) scale(0.985);
        box-shadow:
          0 6px 14px rgba(148, 163, 184, 0.14),
          inset 0 2px 8px rgba(15, 23, 42, 0.12);
      }

      .control-button[data-role="tap"]:active,
      .control-button[data-role="tap"].is-pressed {
        box-shadow:
          0 7px 16px rgba(15, 23, 42, 0.18),
          inset 0 2px 10px rgba(2, 6, 23, 0.34);
      }

      .control-button:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 3px;
      }

      @media (max-width: 900px) {
        .page {
          width: min(100vw - 24px, 720px);
          padding-top: 24px;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        .preview-shell,
        .canvas-frame,
        canvas {
          width: 100%;
          max-width: ${PREVIEW_WIDTH}px;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <p class="eyebrow">AIX Preview</p>
        <h1 id="preview-title">${escapeHtml(title)}</h1>
        <div class="meta">
          <span>Source: <span id="preview-source">${escapeHtml(config.sourceLabel)}</span></span>
          <span>Version: <span id="preview-version">${escapeHtml(versionLabel)}</span></span>
          <span>Files: <span id="preview-files">${String(config.fileCount ?? 0)}</span></span>
        </div>
      </section>

      <section class="layout">
        <div class="card preview-card">
          <div class="preview-shell">
            <div class="canvas-frame" id="canvas-host">
              <canvas id="preview-canvas" tabindex="0" aria-label="AIX preview canvas"></canvas>
            </div>
          </div>
        </div>

        <aside class="card sidebar">
          <div class="status" id="preview-status">Preparing preview...</div>
          <div class="controls-panel" aria-label="Preview controls">
            <div class="controls-grid">
              <button type="button" class="control-button" data-key="Backspace" aria-label="Backspace">&#8592;</button>
              <button type="button" class="control-button" data-role="tap" data-key="Enter" aria-label="Enter">Enter</button>
              <button type="button" class="control-button" data-key="ArrowUp" aria-label="ArrowUp">&#8593;</button>
              <button type="button" class="control-button" data-key="ArrowDown" aria-label="ArrowDown">&#8595;</button>
            </div>
          </div>
        </aside>
      </section>
    </main>

    <script id="aix-preview-config" type="application/json">${runtimeConfig}</script>
    <script type="module">
      const previewConfigNode = document.getElementById("aix-preview-config");
      const previewConfig = JSON.parse(previewConfigNode.textContent ?? "{}");
      const titleNode = document.getElementById("preview-title");
      const sourceNode = document.getElementById("preview-source");
      const versionNode = document.getElementById("preview-version");
      const filesNode = document.getElementById("preview-files");
      const statusNode = document.getElementById("preview-status");
      const canvasHost = document.getElementById("canvas-host");
      const controlButtons = Array.from(document.querySelectorAll(".control-button"));

      let currentCanvas = document.getElementById("preview-canvas");
      let currentView = null;
      let inkModulePromise;
      let controlsBound = false;
      let socket;

      function setStatus(message, tone = "info") {
        statusNode.dataset.tone = tone;
        statusNode.textContent = message;
      }

      function decodeBase64(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
      }

      function bundleFiles(files) {
        return Object.fromEntries(
          files.map((file) => [file.path, decodeBase64(file.base64)]),
        );
      }

      function updateMeta(state) {
        const title = state.title?.trim() || state.sourceName || sourceNode.textContent || "AIX Preview";
        titleNode.textContent = title;
        sourceNode.textContent = state.sourceName;
        versionNode.textContent = state.version?.trim() || "Unknown";
        filesNode.textContent = String(state.files.length);
        document.title = title + " - AIX Preview";
      }

      function keyCodeFor(key) {
        switch (key) {
          case "Backspace":
            return 8;
          case "Enter":
            return 13;
          case "ArrowUp":
            return 38;
          case "ArrowDown":
            return 40;
          default:
            return 0;
        }
      }

      function dispatchKeyboardEvent(type, key) {
        const keyCode = keyCodeFor(key);
        const event = new KeyboardEvent(type, {
          key,
          code: key,
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, "keyCode", { value: keyCode });
        Object.defineProperty(event, "which", { value: keyCode });
        currentCanvas.dispatchEvent(event);
      }

      function triggerGlobalHook(key) {
        const hook = globalThis.GlobalHook;
        const payload = {
          type: "preview-control",
          key,
          target: "canvas",
          appId: window.__AIX_PREVIEW_APP_ID__,
        };

        if (!hook) {
          return;
        }

        if (typeof hook === "function") {
          hook(payload);
          return;
        }

        for (const methodName of ["emit", "trigger", "call", "invoke", "dispatch"]) {
          const method = hook[methodName];
          if (typeof method === "function") {
            method.call(hook, "preview-control", payload);
            return;
          }
        }
      }

      function bindControlButtons() {
        if (controlsBound) {
          return;
        }
        controlsBound = true;
        for (const button of controlButtons) {
          button.addEventListener("click", () => {
            const key = button.dataset.key;
            if (!key) {
              return;
            }
            triggerGlobalHook(key);
            currentCanvas.focus();
            dispatchKeyboardEvent("keydown", key);
            dispatchKeyboardEvent("keyup", key);
          });
        }
      }

      function ensureInkModule() {
        if (!inkModulePromise) {
          inkModulePromise = import(previewConfig.inkSdkUrl);
        }
        return inkModulePromise;
      }

      function recreateCanvas() {
        const nextCanvas = document.createElement("canvas");
        nextCanvas.id = "preview-canvas";
        nextCanvas.tabIndex = 0;
        nextCanvas.setAttribute("aria-label", "AIX preview canvas");
        canvasHost.replaceChildren(nextCanvas);
        currentCanvas = nextCanvas;
        return nextCanvas;
      }

      async function teardownView() {
        const previousView = currentView;
        currentView = null;
        if (!previousView) {
          recreateCanvas();
          return;
        }

        for (const methodName of ["destroy", "dispose", "close"]) {
          const method = previousView[methodName];
          if (typeof method === "function") {
            await method.call(previousView);
            break;
          }
        }
        recreateCanvas();
      }

      async function fetchPreviewState() {
        const response = await fetch(previewConfig.statePath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await response.text() || "Failed to fetch preview state");
        }
        return await response.json();
      }

      async function mountState(state, reason) {
        updateMeta(state);
        setStatus(reason);
        await teardownView();

        const { createInkView } = await ensureInkModule();
        const view = await createInkView({
          width: ${PREVIEW_WIDTH},
          height: ${PREVIEW_HEIGHT},
          layoutMode: "bounded",
          scaleFactor: window.devicePixelRatio || 1,
          appFps: 30,
          canvas: currentCanvas,
        });

        if (typeof view.bindDomEvents === "function") {
          view.bindDomEvents({ canvas: currentCanvas });
        }

        currentView = view;
        window.__AIX_PREVIEW_APP_ID__ = state.appId;
        view.openBundle({
          appId: state.appId,
          files: bundleFiles(state.files),
        });
        currentCanvas.focus();
        setStatus(
          previewConfig.mode === "dev"
            ? "Preview ready. Listening for changes..."
            : "Preview ready.",
        );
      }

      function connectWebSocket() {
        if (previewConfig.mode !== "dev") {
          return;
        }

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        socket = new WebSocket(protocol + "://" + window.location.host + ${JSON.stringify(DEV_WS_PATH)});

        socket.addEventListener("message", async (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "reload") {
              setStatus("Changes detected. Reloading preview...");
              const nextState = await fetchPreviewState();
              await mountState(nextState, "Applying latest changes...");
            } else if (message.type === "error") {
              setStatus("Preview update failed.\\n\\n" + message.message, "error");
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus("Preview update failed.\\n\\n" + message, "error");
          }
        });

        socket.addEventListener("close", () => {
          window.setTimeout(() => {
            if (previewConfig.mode === "dev") {
              connectWebSocket();
            }
          }, 1000);
        });
      }

      async function boot() {
        bindControlButtons();

        if (previewConfig.mode === "dev") {
          setStatus("Loading preview state from dev server...");
          const state = await fetchPreviewState();
          await mountState(state, "Initializing Ink runtime...");
          connectWebSocket();
          return;
        }

        await mountState(previewConfig.initialState, "Initializing Ink runtime...");
      }

      boot().catch((error) => {
        const message = error instanceof Error ? error.stack || error.message : String(error);
        setStatus("Preview failed to start.\\n\\n" + message, "error");
        console.error(error);
      });
    </script>
  </body>
</html>
`;
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
