import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
test("all-source failure preserves the exact versioned snapshot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-outage-"));
  const adapter: Adapter = {
    id: "fixture",
    name: "Fixture",
    url: "https://example.com",
    async run() {
      return { message: "Stable" };
    },
  };
  await refresh({ directory, adapters: [adapter] });
  const before = await readFile(join(directory, "radar.json"), "utf8");
  await assert.rejects(
    refresh({
      directory,
      adapters: [
        {
          ...adapter,
          async run() {
            throw Error("HTTP 503");
          },
        },
      ],
    }),
    /All sources failed/,
  );
  assert.equal(await readFile(join(directory, "radar.json"), "utf8"), before);
});
test("invalid adapter batches are isolated from healthy source updates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-invalid-"));
  const adapter: Adapter = {
    id: "invalid",
    name: "Invalid",
    url: "https://example.com",
    async run() {
      return {
        models: [
          {
            ...newModel("test/bad", "Bad", "https://example.com", "Test"),
            context: -1,
          },
        ],
        message: "Bad payload",
      };
    },
  };
  const healthy: Adapter = {
    ...adapter,
    id: "healthy",
    async run() {
      return { message: "Healthy" };
    },
  };
  const result = await refresh({ directory, adapters: [adapter, healthy] });
  assert.equal(result.data.models.length, 0);
  assert.equal(
    result.data.sources.find((s) => s.id === "invalid")?.status,
    "error",
  );
});
test("aging evidence causes a material change without a changed upstream payload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "radar-aging-"));
  const adapter: Adapter = {
    id: "fixture",
    name: "Fixture",
    url: "https://example.com",
    async run() {
      return { message: "Stable" };
    },
  };
  await refresh({ directory, adapters: [adapter] });
  const snapshot = JSON.parse(
    await readFile(join(directory, "radar.json"), "utf8"),
  );
  snapshot.refreshedAt = new Date(Date.now() - 2 * 86400000).toISOString();
  snapshot.models = [
    newModel("test/model", "Model", "https://example.com", "Test"),
  ];
  snapshot.evidence = [20, 50, 80].map((value, i) => ({
    id: `result${i}`,
    modelId: i === 2 ? "test/model" : `peer${i}`,
    benchmark: "cybergym",
    protocol: "same",
    value,
    kind: "independent",
    source: "https://example.com",
    sourceId: "fixture",
    observedAt: new Date(Date.now() - 366 * 86400000).toISOString(),
    notes: "",
  }));
  await writeFile(join(directory, "radar.json"), JSON.stringify(snapshot));
  assert.equal(
    (await refresh({ directory, adapters: [adapter] })).changed,
    true,
  );
  const ranked = JSON.parse(
    await readFile(join(directory, "rankings.json"), "utf8"),
  );
  assert.equal(ranked[0].overall, null);
});
