import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admintops",
          "/admintops/",
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
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
