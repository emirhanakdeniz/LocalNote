import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
} from "@blocknote/core";
import { createBundledHighlighter, createCssVariablesTheme } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";

export const codeLanguages: Record<
  string,
  { name: string; aliases?: string[] }
> = {
  text: { name: "Plain text", aliases: ["txt", "plaintext", "none"] },
  java: { name: "Java" },
  javascript: { name: "JavaScript", aliases: ["js"] },
  typescript: { name: "TypeScript", aliases: ["ts"] },
  json: { name: "JSON" },
  sql: { name: "SQL" },
  shellscript: { name: "Bash / Shell", aliases: ["bash", "sh", "shell"] },
  powershell: { name: "PowerShell", aliases: ["ps1", "pwsh"] },
  python: { name: "Python", aliases: ["py"] },
  html: { name: "HTML" },
  css: { name: "CSS" },
};

const bundledLanguages = {
  java: () => import("@shikijs/langs-precompiled/java"),
  javascript: () => import("@shikijs/langs-precompiled/javascript"),
  typescript: () => import("@shikijs/langs-precompiled/typescript"),
  json: () => import("@shikijs/langs-precompiled/json"),
  sql: () => import("@shikijs/langs-precompiled/sql"),
  shellscript: () => import("@shikijs/langs-precompiled/shellscript"),
  powershell: () => import("@shikijs/langs-precompiled/powershell"),
  python: () => import("@shikijs/langs-precompiled/python"),
  html: () => import("@shikijs/langs-precompiled/html"),
  css: () => import("@shikijs/langs-precompiled/css"),
};

const localNoteCodeTheme = createCssVariablesTheme({
  name: "localnote",
  variablePrefix: "--code-",
  fontStyle: true,
  variableDefaults: {
    foreground: "#2b303c",
    background: "#f6f7fb",
    "token-comment": "#7a8394",
    "token-string": "#267b54",
    "token-constant": "#0f7488",
    "token-keyword": "#6351b5",
    "token-parameter": "#3d526e",
    "token-function": "#1d68bd",
    "token-string-expression": "#1a776f",
    "token-punctuation": "#5a6474",
    "token-link": "#1d68bd",
  },
});

const createLocalNoteHighlighter = createBundledHighlighter({
  langs: bundledLanguages,
  themes: { localnote: localNoteCodeTheme },
  engine: () => createJavaScriptRegexEngine(),
});

let highlighter: ReturnType<typeof createLocalNoteHighlighter> | undefined;

function getLocalNoteHighlighter() {
  highlighter ??= createLocalNoteHighlighter({
    themes: ["localnote"],
    langs: [],
  });
  return highlighter;
}

export const localNoteSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec({
      indentLineWithTab: true,
      defaultLanguage: "text",
      supportedLanguages: codeLanguages,
      createHighlighter: getLocalNoteHighlighter,
    }),
  },
});
