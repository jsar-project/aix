import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { DEV_STATE_PATH, DEV_WS_PATH } from "./constants";
import { renderPreviewHtml } from "./html";
import { buildPreviewState } from "./state";
import type { DevPreviewMessage, PreviewServer, PreviewTarget } from "./types";
import { formatError } from "./utils";
import { startSourceWatcher } from "./watcher";

export async function startStaticPreviewServer(
  html: string,
): Promise<PreviewServer> {
  const server = http.createServer((req, res) => {
    if (!req.url || req.url === "/" || req.url.startsWith("/?")) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(html);
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end("ok");
      return;
    }

    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end("Not Found");
  });

  const url = await listenOnLoopback(server);
  return {
    url,
    close: () => {
      server.close();
    },
  };
}

export async function startDevPreviewServer(
  inputPath: string,
  inkRuntimeVersion: string,
  inkImportMap: { imports: Record<string, string> },
): Promise<PreviewServer> {
  let currentState = buildPreviewState(inputPath);
  let revision = 0;
  const sourceLabel = currentState.sourceName;
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(404).end();
      return;
    }

    const requestUrl = new URL(req.url, "http://127.0.0.1");
    if (requestUrl.pathname === "/") {
      const html = renderPreviewHtml({
        mode: "dev",
        sourceLabel,
        inkRuntimeVersion,
        inkImportMap,
        title: currentState.title,
        version: currentState.version,
        fileCount: currentState.files.length,
        statePath: DEV_STATE_PATH,
      });
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(html);
      return;
    }

    if (requestUrl.pathname === DEV_STATE_PATH) {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(currentState));
      return;
    }

    if (requestUrl.pathname === "/health") {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end("ok");
      return;
    }

    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end("Not Found");
  });

  const wsServer = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname !== DEV_WS_PATH) {
      socket.destroy();
      return;
    }
    wsServer.handleUpgrade(req, socket, head, (webSocket: WebSocket) => {
      wsServer.emit("connection", webSocket, req);
    });
  });

  const broadcast = (message: DevPreviewMessage) => {
    const payload = JSON.stringify(message);
    for (const client of wsServer.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  };

  const rebuild = () => {
    try {
      currentState = buildPreviewState(inputPath);
      revision += 1;
      broadcast({ type: "reload", revision });
      process.stdout.write(`Preview updated: ${currentState.sourceName}\n`);
    } catch (error) {
      revision += 1;
      broadcast({
        type: "error",
        revision,
        message: formatError(error),
      });
    }
  };

  const stopWatching = startSourceWatcher(inputPath, rebuild);
  const url = await listenOnLoopback(server);

  return {
    url,
    close: () => {
      stopWatching();
      for (const client of wsServer.clients) {
        client.close();
      }
      wsServer.close();
      server.close();
    },
  };
}

function listenOnLoopback(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine preview server address"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}/`);
    });
  });
}
