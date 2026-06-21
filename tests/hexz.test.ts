import { afterEach, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  VERSION,
  HexzPlugin,
  escapeHtml,
  isInsidePath,
  isSafeWebUrl,
  redactSecrets,
  resolveProjectPath,
} from "../src/hexz"
import { hexz_mkp } from "../src/hexz-mimo"
import { isSafePackageName, parseGithubRepo } from "../src/shared"

const originalCwd = process.cwd()

afterEach(() => {
  process.chdir(originalCwd)
})

describe("VERSION", () => {
  it("matches package.json version", () => {
    expect(VERSION).toBe("1.5.2")
  })
})

describe("MiMo marketplace helpers", () => {
  it("validates GitHub repo targets without treating npm scopes as repos", () => {
    expect(parseGithubRepo("owner/repo")).toEqual(["owner", "repo"])
    expect(parseGithubRepo("@scope/package")).toBeNull()
    expect(parseGithubRepo("owner/repo;rm -rf /")).toBeNull()
  })

  it("accepts scoped packages and rejects shell metacharacters", () => {
    expect(isSafePackageName("left-pad")).toBe(true)
    expect(isSafePackageName("@scope/package")).toBe(true)
    expect(isSafePackageName("pkg && rm -rf /")).toBe(false)
  })

  it("removes marketplace files instead of truncating them", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hexz-mkp-"))
    try {
      process.chdir(dir)
      const toolsDir = join(dir, ".mimocode", "tools")
      const commandsDir = join(dir, ".mimocode", "commands")
      mkdirSync(toolsDir, { recursive: true })
      mkdirSync(commandsDir, { recursive: true })
      writeFileSync(join(toolsDir, "demo.ts"), "export default {}")
      writeFileSync(join(commandsDir, "demo.md"), "---\ndescription: demo\n---\n")

      const result = await hexz_mkp.execute({ target: "remove:demo" })

      expect(result).toContain("Removed demo")
      expect(existsSync(join(toolsDir, "demo.ts"))).toBe(false)
      expect(existsSync(join(commandsDir, "demo.md"))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("HexzPlugin exports", () => {
  it("exports a function", () => {
    expect(typeof HexzPlugin).toBe("function")
  })
})

describe("safety helpers", () => {
  it("keeps resolved paths inside the project", () => {
    expect(resolveProjectPath("/tmp/project", "src/file.ts")).toBe("/tmp/project/src/file.ts")
    expect(resolveProjectPath("/tmp/project", "../secret.txt")).toBeNull()
    expect(isInsidePath("/tmp/project", "/tmp/project/src/file.ts")).toBe(true)
    expect(isInsidePath("/tmp/project", "/tmp/secret.txt")).toBe(false)
  })

  it("blocks localhost and private screenshot URLs", () => {
    expect(isSafeWebUrl("https://example.com")).toBe(true)
    expect(isSafeWebUrl("http://localhost:3000")).toBe(false)
    expect(isSafeWebUrl("http://127.0.0.1:3000")).toBe(false)
    expect(isSafeWebUrl("http://192.168.1.10")).toBe(false)
    expect(isSafeWebUrl("file:///etc/passwd")).toBe(false)
  })

  it("escapes generated HTML content", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    )
  })

  it("redacts secrets without dropping key names", () => {
    expect(redactSecrets(`api_key="abc123" password="secret" token="tok"`)).toBe(
      `api_key="REDACTED" password="REDACTED" token="REDACTED"`,
    )
  })
})
