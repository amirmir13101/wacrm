import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/automations",
          "/automations/",
          "/broadcasts",
          "/broadcasts/",
          "/change-password",
          "/contacts",
          "/contacts/",
          "/dashboard",
          "/forgot-password",
          "/inbox",
          "/invite",
          "/invite/",
          "/login",
          "/pending-approval",
          "/pipelines",
          "/settings",
          "/signup",
          "/team",
        ],
      },
    ],
    sitemap: "https://vpscoaster.live/sitemap.xml",
    host: "https://vpscoaster.live",
  };
}
