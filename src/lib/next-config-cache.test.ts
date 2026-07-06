import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";

describe("Next.js cache headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not apply production cache rules during local development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const headers = await nextConfig.headers?.();

    expect(headers).toBeDefined();
    expect(headers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "/_next/static/:path*" }),
      ]),
    );
    expect(headers).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "/:path*" })]),
    );
  });

  it("keeps immutable static asset caching in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const headers = await nextConfig.headers?.();

    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/_next/static/:path*",
          headers: expect.arrayContaining([
            expect.objectContaining({
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            }),
          ]),
        }),
      ]),
    );
  });

  it("marks APIs and protected pages private no-store without a public catch-all", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const headers = await nextConfig.headers?.();
    const cacheRules = (headers ?? []).filter((rule) =>
      rule.headers.some((header) => header.key === "Cache-Control"),
    );

    expect(cacheRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/:path*",
          headers: expect.arrayContaining([
            expect.objectContaining({
              value: "private, no-store, max-age=0, must-revalidate",
            }),
          ]),
        }),
        expect.objectContaining({
          source: "/dashboard/:path*",
          headers: expect.arrayContaining([
            expect.objectContaining({ value: expect.stringContaining("no-store") }),
          ]),
        }),
      ]),
    );
    expect(cacheRules).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/:path*",
          headers: expect.arrayContaining([
            expect.objectContaining({ value: expect.stringContaining("public") }),
          ]),
        }),
      ]),
    );
  });
});
