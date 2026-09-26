// Unit tests for the wire graph helpers (fix #6: testing gap).
// Runs with Node's built-in runner, no deps: `node --test test/wire-helpers.test.js`
// Imports the TS module directly (Node >= 22.18 type-stripping, erasable syntax only).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shortLabel,
  maskKey,
  matchMemberId,
  normProv,
  provIdFor,
  provLabelsMatch,
  fadeOpacity,
  sameActiveReqs,
  timeAgo,
} from "../admin-panel/src/lib/graph-helpers.ts";

describe("shortLabel", () => {
  it("initials of first two words", () => assert.equal(shortLabel("Kiro AI"), "KA"));
  it("single word takes first two letters", () => assert.equal(shortLabel("antigravity"), "AN"));
  it("short names uppercased", () => assert.equal(shortLabel("x"), "X"));
  it("empty falls back to ?", () => assert.equal(shortLabel(""), "?"));
  it("splits on dashes", () => assert.equal(shortLabel("mi-mo"), "MM"));
});

describe("maskKey", () => {
  it("truncates long keys to 10 chars + ...", () =>
    assert.equal(maskKey("sk-1ee0c9854793d04c-abcdef"), "sk-1ee0c98..."));
  it("passes backend masks through", () =>
    assert.equal(maskKey("sk-1ee0c9854..."), "sk-1ee0c9854..."));
  it("dash stays dash", () => assert.equal(maskKey("-"), "-"));
  it("short keys unchanged", () => assert.equal(maskKey("sk-short"), "sk-short"));
});

describe("matchMemberId", () => {
  const members = [{ id: "key-abc", fullKey: "sk-1ee0c9854793d04c-abcdef12345678" }];
  it("matches real backend mask (12-char prefix + ...)", () =>
    assert.equal(matchMemberId(members, "sk-1ee0c9854..."), "key-abc"));
  it("matches *** masks too", () =>
    assert.equal(matchMemberId(members, "sk-1ee0c9854***"), "key-abc"));
  it("rejects short prefixes", () =>
    assert.equal(matchMemberId(members, "sk-1..."), null));
  it("unknown key returns null (no phantom match)", () =>
    assert.equal(matchMemberId(members, "sk-zzzzzzzz9..."), null));
  it("dash returns null", () => assert.equal(matchMemberId(members, "-"), null));
});

describe("provider dedupe", () => {
  it("normProv strips case and separators", () =>
    assert.equal(normProv("Kiro AI"), "kiroai"));
  it("provIdFor slugs with dashes", () =>
    assert.equal(provIdFor("Kiro AI"), "prov-kiro-ai"));
  it("kiro matches Kiro AI (the reported duplicate)", () =>
    assert.equal(provLabelsMatch("kiro", "Kiro AI"), true));
  it("short stems do not merge (ant vs antigravity)", () =>
    assert.equal(provLabelsMatch("ant", "antigravity"), false));
  it("empty never matches", () => assert.equal(provLabelsMatch("", "x"), false));
  it("same family merges (openai vs openai-compatible)", () =>
    assert.equal(provLabelsMatch("openai", "openai-compatible"), true));
});

describe("fadeOpacity", () => {
  it("full opacity inside window", () => assert.equal(fadeOpacity(0), 1));
  it("still full at 39999ms", () => assert.equal(fadeOpacity(39999), 1));
  it("mid fade at 50000ms", () => assert.equal(fadeOpacity(50000), 0.65));
  it("floors at 0.3", () => assert.equal(fadeOpacity(10_000_000), 0.3));
});

describe("sameActiveReqs", () => {
  const a = [{ provider: "antigravity", account: "x@y.z", model: "m", count: 1 }];
  it("order-insensitive equality", () =>
    assert.equal(sameActiveReqs(a, [...a]), true));
  it("detects count change", () =>
    assert.equal(
      sameActiveReqs(a, [{ provider: "antigravity", account: "x@y.z", model: "m", count: 2 }]),
      false
    ));
  it("empty equals empty (idle bail-out)", () =>
    assert.equal(sameActiveReqs([], []), true));
});

describe("timeAgo", () => {
  const NOW = 1_700_000_000_000;
  it("just now under 10s", () => assert.equal(timeAgo(NOW - 5_000, NOW), "just now"));
  it("seconds", () => assert.equal(timeAgo(NOW - 45_000, NOW), "45s ago"));
  it("minutes like native", () => assert.equal(timeAgo(NOW - 8 * 60_000, NOW), "8m ago"));
  it("hours like native", () => assert.equal(timeAgo(NOW - 3_600_000, NOW), "1h ago"));
  it("days", () => assert.equal(timeAgo(NOW - 2 * 86_400_000, NOW), "2d ago"));
  it("future clamps to just now", () => assert.equal(timeAgo(NOW + 60_000, NOW), "just now"));
});
