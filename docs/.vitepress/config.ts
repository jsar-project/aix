import { defineConfig } from "vitepress";
import { searchForWorkspaceRoot } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

function normalizeBasePath(input: string | undefined): string {
  if (!input || input === "/") {
    return "/";
  }

  const withLeadingSlash = input.startsWith("/") ? input : `/${input}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

const runtimeProcess = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const base = normalizeBasePath(runtimeProcess.process?.env?.BASE_PATH ?? "/aix");
const docsRoot = new URL("..", import.meta.url).pathname;
const workspaceRoot = searchForWorkspaceRoot(docsRoot);
const aixWebRoot = new URL("../../crates/aix-web/", import.meta.url).pathname;

export default defineConfig({
  title: "AIX",
  description: "Official documentation and package lab for the AIX file format.",
  base,
  vite: {
    plugins: [wasm(), topLevelAwait()],
    server: {
      fs: {
        allow: [workspaceRoot, aixWebRoot]
      }
    }
  },
  appearance: false,
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ["meta", { name: "theme-color", content: "#f4f1e9" }],
    ["meta", { property: "og:title", content: "AIX" }],
    [
      "meta",
      {
        property: "og:description",
        content: "AIX is a file format for package structure, page schema, and tool surfaces."
      }
    ]
  ],
  themeConfig: {
    siteTitle: '<span class="aix-brand-aiui">AIUI</span> <span class="aix-brand-aix">AIX</span>',
    nav: [
      { text: "Specification", link: "/spec" },
      { text: "CLI", link: "/cli" },
      { text: "Packages", link: "/packages" },
      { text: "Play", link: "/play" },
      { text: "GitHub", link: "https://github.com/jsar-project/aix" }
    ],
    sidebar: [
      {
        text: "AIX",
        items: [
          { text: "Specification", link: "/spec" },
          { text: "CLI", link: "/cli" },
          { text: "Packages", link: "/packages" }
        ]
      }
    ],
    docFooter: {
      prev: "Previous",
      next: "Next"
    },
    footer: {
      message: "AIX file format documentation and package lab.",
      copyright: "Released for the jsar-project/aix repository."
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/jsar-project/aix" }
    ],
    outline: "deep",
    search: {
      provider: "local"
    }
  }
});
