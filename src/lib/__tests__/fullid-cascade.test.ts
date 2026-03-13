import { describe, it, expect } from "vitest";
import {
  computeFullIdPrefix,
  computeNewFullId,
  replaceFullIdPrefix,
  replaceFullIdInHtml,
} from "@/lib/fullid-cascade";

// ---------------------------------------------------------------------------
// computeFullIdPrefix
// ---------------------------------------------------------------------------
describe("computeFullIdPrefix", () => {
  it("returns codePrefix + dash for root items", () => {
    expect(computeFullIdPrefix(null, "RMS")).toBe("RMS-");
  });

  it("returns parentFullId + dash for child items", () => {
    expect(computeFullIdPrefix("RMS-1", null)).toBe("RMS-1-");
  });

  it("prefers parentFullId when both are provided", () => {
    expect(computeFullIdPrefix("RMS-1", "RMS")).toBe("RMS-1-");
  });

  it("works with deeply nested parents", () => {
    expect(computeFullIdPrefix("RMS-1-2-3", null)).toBe("RMS-1-2-3-");
  });

  it("throws when both arguments are null", () => {
    expect(() => computeFullIdPrefix(null, null)).toThrow(
      "Either parentFullId or codePrefix must be provided"
    );
  });
});

// ---------------------------------------------------------------------------
// computeNewFullId
// ---------------------------------------------------------------------------
describe("computeNewFullId", () => {
  it("generates root fullId from codePrefix and seq", () => {
    expect(computeNewFullId("RMS", null, 3)).toBe("RMS-3");
  });

  it("generates child fullId from parentFullId and seq", () => {
    expect(computeNewFullId(null, "RMS-1", 2)).toBe("RMS-1-2");
  });

  it("generates deeply nested fullId", () => {
    expect(computeNewFullId(null, "RMS-1-2-3", 5)).toBe("RMS-1-2-3-5");
  });

  it("handles seq = 1", () => {
    expect(computeNewFullId("WQ", null, 1)).toBe("WQ-1");
  });

  it("handles large sequence numbers", () => {
    expect(computeNewFullId(null, "RMS-1", 100)).toBe("RMS-1-100");
  });
});

// ---------------------------------------------------------------------------
// replaceFullIdPrefix
// ---------------------------------------------------------------------------
describe("replaceFullIdPrefix", () => {
  it("replaces exact match", () => {
    expect(replaceFullIdPrefix("RMS-1-2", "RMS-1-2", "RMS-1-1")).toBe(
      "RMS-1-1"
    );
  });

  it("replaces descendant (child)", () => {
    expect(replaceFullIdPrefix("RMS-1-2-3", "RMS-1-2", "RMS-1-1")).toBe(
      "RMS-1-1-3"
    );
  });

  it("replaces deeply nested descendant", () => {
    expect(
      replaceFullIdPrefix("RMS-1-2-3-4-5", "RMS-1-2", "RMS-3")
    ).toBe("RMS-3-3-4-5");
  });

  it("does NOT match partial numeric overlap (RMS-1-20 vs RMS-1-2)", () => {
    expect(replaceFullIdPrefix("RMS-1-20", "RMS-1-2", "RMS-1-1")).toBe(
      "RMS-1-20"
    );
  });

  it("does NOT match partial numeric overlap on descendants", () => {
    expect(
      replaceFullIdPrefix("RMS-1-20-3", "RMS-1-2", "RMS-1-1")
    ).toBe("RMS-1-20-3");
  });

  it("returns original when no match at all", () => {
    expect(replaceFullIdPrefix("WQ-1-1", "RMS-1-2", "RMS-1-1")).toBe(
      "WQ-1-1"
    );
  });

  it("handles replacing root-level prefix", () => {
    expect(replaceFullIdPrefix("RMS-1", "RMS-1", "RMS-2")).toBe("RMS-2");
  });

  it("handles replacing root with descendant", () => {
    expect(replaceFullIdPrefix("RMS-1-3", "RMS-1", "RMS-2")).toBe("RMS-2-3");
  });

  it("does NOT match when oldPrefix is a substring but not at boundary", () => {
    // "RMS-1" should not match "RMS-10"
    expect(replaceFullIdPrefix("RMS-10", "RMS-1", "RMS-2")).toBe("RMS-10");
  });

  it("does NOT match RMS-10's children when looking for RMS-1", () => {
    expect(replaceFullIdPrefix("RMS-10-1", "RMS-1", "RMS-2")).toBe("RMS-10-1");
  });
});

// ---------------------------------------------------------------------------
// replaceFullIdInHtml
// ---------------------------------------------------------------------------
describe("replaceFullIdInHtml", () => {
  // --- data-item-id attribute ---
  it("replaces data-item-id exact match", () => {
    const html = '<a data-item-id="RMS-1-2" href="#">link</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a data-item-id="RMS-1-1" href="#">link</a>');
  });

  it("replaces data-item-id descendant", () => {
    const html = '<a data-item-id="RMS-1-2-3" href="#">link</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a data-item-id="RMS-1-1-3" href="#">link</a>');
  });

  it("does NOT replace partial data-item-id (RMS-1-20)", () => {
    const html = '<a data-item-id="RMS-1-20" href="#">link</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  // --- link text ---
  it("replaces link text exact match", () => {
    const html = '<a href="/item/1">RMS-1-2</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a href="/item/1">RMS-1-1</a>');
  });

  it("replaces link text descendant", () => {
    const html = '<a href="/item/1">RMS-1-2-3</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe('<a href="/item/1">RMS-1-1-3</a>');
  });

  it("does NOT replace partial link text (RMS-1-20)", () => {
    const html = '<a href="/item/1">RMS-1-20</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  // --- combined ---
  it("replaces both attribute and link text in one pass", () => {
    const html =
      '<a data-item-id="RMS-1-2" href="/item/1">RMS-1-2</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe(
      '<a data-item-id="RMS-1-1" href="/item/1">RMS-1-1</a>'
    );
  });

  it("handles multiple occurrences", () => {
    const html =
      '<p>See <a data-item-id="RMS-1-2" href="#">RMS-1-2</a> and <a data-item-id="RMS-1-2-3" href="#">RMS-1-2-3</a></p>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe(
      '<p>See <a data-item-id="RMS-1-1" href="#">RMS-1-1</a> and <a data-item-id="RMS-1-1-3" href="#">RMS-1-1-3</a></p>'
    );
  });

  it("returns null when no changes are made", () => {
    const html = "<p>No item references here.</p>";
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  it("returns null for completely unrelated IDs", () => {
    const html = '<a data-item-id="WQ-5" href="#">WQ-5</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  it("handles empty HTML", () => {
    expect(replaceFullIdInHtml("", "RMS-1", "RMS-2")).toBeNull();
  });

  it("does not replace fullId outside of recognized patterns", () => {
    // Plain text mention should NOT be replaced (only data-item-id attrs and >...</a> text)
    const html = "<p>Item RMS-1-2 is important.</p>";
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBeNull();
  });

  it("correctly handles mixed matching and non-matching IDs", () => {
    const html =
      '<a data-item-id="RMS-1-2" href="#">RMS-1-2</a> and <a data-item-id="RMS-1-20" href="#">RMS-1-20</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-1-1");
    expect(result).toBe(
      '<a data-item-id="RMS-1-1" href="#">RMS-1-1</a> and <a data-item-id="RMS-1-20" href="#">RMS-1-20</a>'
    );
  });

  it("handles deeply nested descendant in HTML", () => {
    const html = '<a data-item-id="RMS-1-2-3-4-5" href="#">RMS-1-2-3-4-5</a>';
    const result = replaceFullIdInHtml(html, "RMS-1-2", "RMS-3");
    expect(result).toBe(
      '<a data-item-id="RMS-3-3-4-5" href="#">RMS-3-3-4-5</a>'
    );
  });
});
