import { describe, expect, it } from "bun:test"
import {
  VERSION,
  HexzPlugin,
  escapeHtml,
  isInsidePath,
  isSafeWebUrl,
  redactSecrets,
  resolveProjectPath,
} from "../src/hexz"

describe("VERSION", () => {
  it("matches package.json version", () => {
    expect(VERSION).toBe("1.5.0")
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
