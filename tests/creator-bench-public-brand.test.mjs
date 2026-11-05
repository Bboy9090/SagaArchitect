import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("public Creator Bench surfaces use the approved product name", () => {
  const readme = readFileSync("README.md", "utf8");
  const studio = readFileSync("src/app/universe/[id]/studio/page.tsx", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");

  assert.match(readme, /^# Phoenix Creator Bench/m);
  assert.doesNotMatch(readme, /Phoenix Creator Studio/);
  assert.match(studio, /Phoenix Creator Bench/);
  assert.doesNotMatch(studio, /Phoenix Creator Studio/);
  assert.match(layout, /phoenix-creator-bench-logo\.png/);
});

test("Creator Bench logo alias preserves the current source artwork bytes", () => {
  assert.equal(
    readFileSync("public/phoenix-creator-bench-logo.png").toString("base64"),
    readFileSync("public/sagaarchitect-logo.png").toString("base64"),
  );
});
