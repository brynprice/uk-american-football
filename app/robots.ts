import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/login",
          "/propose-game?*",
          "/scorigami?*",
          "/teams?*",
        ],
      },
      {
        userAgent: [
          "AhrefsBot",
          "SemrushBot",
          "MJ12bot",
          "DotBot",
          "Bytespider",
          "CCBot",
          "GPTBot",
          "ClaudeBot",
          "Amazonbot",
          "meta-externalagent",
        ],
        disallow: ["/"],
      },
    ],
    sitemap: "https://britball.io/sitemap.xml",
  };
}
