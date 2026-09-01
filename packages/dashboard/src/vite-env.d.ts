/// <reference types="vite/client" />

/**
 * Minimal typing for the google.script.run client API that Apps Script injects
 * into HtmlService pages. Absent when running `vite dev` locally.
 */
interface GoogleScriptRunner {
  withSuccessHandler(handler: (value: unknown) => void): GoogleScriptRunner;
  withFailureHandler(handler: (error: Error) => void): GoogleScriptRunner;
  [fn: string]: ((...args: unknown[]) => void) | GoogleScriptRunner["withSuccessHandler"];
}

interface GoogleScriptHost {
  close(): void;
  setHeight(height: number): void;
  setWidth(width: number): void;
}

declare const google:
  | {
      script: {
        run: GoogleScriptRunner;
        host: GoogleScriptHost;
      };
    }
  | undefined;
