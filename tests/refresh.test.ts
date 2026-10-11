import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { refresh } from "../scripts/refresh";
import { newModel, type Adapter } from "../lib/adapters/types";
test("unchanged polling does not rewrite versioned snapshots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-test-"));
  const source: Adapter = {
    id: "fixture",
    name: "Fixture",
    url: "https://example.com/feed",
    async run() {
      return {
        models: [
          newModel("test/model", "Model", "https://example.com/model", "Test"),
        ],
        message: "Stable observation",
      };
    },
  };
  assert.equal(
    (await refresh({ directory, adapters: [source] })).changed,
    true,
  );
  const before = await readFile(join(directory, "radar.json"), "utf8");
  assert.equal(
    (await refresh({ directory, adapters: [source] })).changed,
    false,
  );
  assert.equal(await readFile(join(directory, "radar.json"), "utf8"), before);
});
test("one unavailable source preserves previously collected models and evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-failure-test-"));
  const original: Adapter = {
    id: "first",
    name: "First",
    url: "https://example.com/feed",
    async run() {
      return {
        models: [
          newModel("test/model", "Model", "https://example.com/model", "Test"),
        ],
        evidence: [
          {
            id: "result",
            modelId: "test/model",
            benchmark: "cybergym",
            protocol: "v1",
            value: 50,
            kind: "independent",
            source: "https://example.com/result",
            sourceId: "first",
            observedAt: new Date().toISOString(),
            notes: "",
          },
        ],
        message: "Available",
      };
    },
  };
  await refresh({ directory, adapters: [original] });
  const fail: Adapter = {
    ...original,
    async run() {
      throw Error("HTTP 429");
    },
  };
  const healthy: Adapter = {
    id: "healthy",
    name: "Healthy",
    url: "https://example.com/other",
    async run() {
      return { message: "Available" };
    },
  };
  const { data } = await refresh({ directory, adapters: [fail, healthy] });
  assert.equal(data.models.length, 1);
  assert.equal(data.evidence[0].value, 50);
  assert.equal(data.sources.find((s) => s.id === "first")?.status, "error");
});
