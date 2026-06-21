import { isAbsolute, relative, resolve } from "node:path";

export function isInsidePath(baseDir: string, targetPath: string): boolean {
  const rel = relative(resolve(baseDir), resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function resolveProjectPath(baseDir: string, input: string): string | null {
  if (!input.trim() || input.includes("\0")) return null;
  const targetPath = resolve(baseDir, input);
  return isInsidePath(baseDir, targetPath) ? targetPath : null;
}

export function isSafeWebUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (["localhost", "0.0.0.0", "127.0.0.1", "::1"].includes(host)) return false;
    if (host.endsWith(".local") || host.startsWith("127.")) return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseGithubRepo(value: string): [string, string] | null {
  if (value.startsWith("@")) return null;
  const parts = value.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  const valid = /^[a-zA-Z0-9._-]+$/;
  return owner && repo && valid.test(owner) && valid.test(repo) ? [owner, repo] : null;
}

export function isSafePackageName(value: string): boolean {
  return /^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(value);
}
