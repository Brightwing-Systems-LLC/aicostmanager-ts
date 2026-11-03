// The client calls the routes the AICM server actually serves: the catalog is
// /pricing/models, and webhooks live under the API key's team.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { CostManagerClient } from "../dist/index.js";

const ROOT = "https://aicm.test/api/v1";

const MODEL = {
  id: "anthropic::claude-fable-5-1",
  model_name: "claude-fable-5-1",
  provider: "Anthropic",
  provider_id: "anthropic",
  first_seen_at: "2026-11-02T15:30:00+00:00",
  input_price: { name: "input", cost: 3, per_quantity: 1000000, currency: "USD", unit: "token" },
  output_price: null,
};

const WEBHOOK = {
  uuid: "w1",
  url: "https://example.com/hook",
  purpose: "limit_notification",
  active: true,
  tolerance: 300,
  created_at: "2026-11-01T00:00:00+00:00",
  updated_at: "2026-11-01T00:00:00+00:00",
};

let calls;

function reply(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), { status });
}

globalThis.fetch = async (url, init) => {
  const u = new URL(url);
  const path = u.pathname.slice("/api/v1".length);
  calls.push({
    method: init.method,
    path,
    query: Object.fromEntries(u.searchParams),
    body: init.body ? JSON.parse(init.body) : undefined,
  });
  if (path === "/teams/") return reply([{ name: "Acme", slug: "acme" }]);
  if (path === "/pricing/models") return reply({ count: 1, models: [MODEL], _links: {} });
  if (path === `/pricing/models/${MODEL.id}`) return reply({ ...MODEL, _links: {} });
  if (path === "/teams/acme/webhooks/") {
    if (init.method === "GET") return reply([WEBHOOK, { ...WEBHOOK, uuid: "w2", active: false }]);
    return reply(WEBHOOK, 201);
  }
  if (path === "/teams/acme/webhooks/w1/") {
    return init.method === "DELETE" ? reply(null, 204) : reply(WEBHOOK);
  }
  return reply({ detail: "Not Found" }, 404);
};

const client = () => new CostManagerClient({ apiKey: "sk", baseUrl: "https://aicm.test" });

beforeEach(() => {
  calls = [];
});

describe("listModels", () => {
  it("lists every model", async () => {
    const res = await client().listModels();
    assert.equal(res.ok, true);
    assert.deepEqual(res.data.map((m) => m.id), [MODEL.id]);
    assert.deepEqual(calls, [{ method: "GET", path: "/pricing/models", query: {}, body: undefined }]);
  });

  it("sends since as ISO for a Date or string", async () => {
    await client().listModels({ since: new Date("2026-11-01T12:00:00Z") });
    await client().listModels({ since: "2026-11-01", provider: "anthropic" });
    assert.deepEqual(calls[0].query, { since: "2026-11-01T12:00:00.000Z" });
    assert.deepEqual(calls[1].query, { since: "2026-11-01", provider: "anthropic" });
  });

  it("gets one model", async () => {
    const res = await client().getModel(MODEL.id);
    assert.equal(res.data.provider_id, "anthropic");
  });

  it("drops the dead vendor methods", () => {
    for (const name of ["listVendors", "listVendorServices", "listServiceCosts"]) {
      assert.equal(typeof client()[name], "undefined");
    }
  });
});

describe("webhooks", () => {
  it("lists under the key's team, looking the slug up once", async () => {
    const c = client();
    const res = await c.listWebhookEndpoints();
    await c.getWebhookEndpoint("w1");
    assert.deepEqual(res.data.endpoints.map((e) => e.uuid), ["w1", "w2"]);
    assert.equal(res.data.total_count, 2);
    assert.equal(res.data.active_count, 1);
    assert.deepEqual(calls.map((x) => x.path), ["/teams/", "/teams/acme/webhooks/", "/teams/acme/webhooks/w1/"]);
  });

  it("filters active only", async () => {
    const res = await client().listWebhookEndpoints(true);
    assert.deepEqual(res.data.endpoints.map((e) => e.uuid), ["w1"]);
  });

  it("creates with POST", async () => {
    const res = await client().createWebhookEndpoint({ url: WEBHOOK.url, secret: "s" });
    assert.equal(res.ok, true);
    assert.equal(res.data.purpose, "limit_notification");
    assert.equal(calls.at(-1).method, "POST");
    assert.equal(calls.at(-1).path, "/teams/acme/webhooks/");
  });

  it("updates with PATCH and only the given fields", async () => {
    await client().updateWebhookEndpoint("w1", { active: false });
    assert.deepEqual(calls.at(-1), {
      method: "PATCH",
      path: "/teams/acme/webhooks/w1/",
      query: {},
      body: { active: false },
    });
  });

  it("deletes", async () => {
    const res = await client().deleteWebhookEndpoint("w1");
    assert.equal(res.ok, true);
    assert.equal(calls.at(-1).path, "/teams/acme/webhooks/w1/");
  });
});
