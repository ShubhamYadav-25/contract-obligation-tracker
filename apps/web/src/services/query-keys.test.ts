import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys.js";

describe("queryKeys", () => {
  it("keeps stable keys for server-state cache invalidation", () => {
    expect(queryKeys.contracts.all).toEqual(["contracts"]);
    expect(queryKeys.contracts.detail("c1")).toEqual(["contracts", "c1"]);
    expect(queryKeys.contracts.textPages("c1")).toEqual(["contracts", "c1", "text-pages"]);
    expect(queryKeys.reviews.detail("r1")).toEqual(["reviews", "r1"]);
    expect(queryKeys.obligations.detail("o1")).toEqual(["obligations", "o1"]);
    expect(queryKeys.messages.list({ limit: 10, offset: 0 })).toEqual([
      "messages",
      "list",
      { limit: 10, offset: 0 },
    ]);
    expect(queryKeys.kpis.latest).toEqual(["kpis", "latest"]);
  });
});
