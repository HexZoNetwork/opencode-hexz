import { describe, expect, it } from "bun:test"
import {
  VERSION,
  HexzPlugin,
} from "../src/hexz"

describe("VERSION", () => {
  it("matches package.json version", () => {
    expect(VERSION).toBe("1.4.0")
  })
})

describe("HexzPlugin exports", () => {
  it("exports a function", () => {
    expect(typeof HexzPlugin).toBe("function")
  })
})
