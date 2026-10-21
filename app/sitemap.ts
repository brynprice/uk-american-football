import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://britball.io";

  // Core static public pages
  const routes = [
    "",
    "/competitions",
    "/teams",
    "/timeline",
    "/people",
    "/scorigami",
    "/champions",
    "/venues",
    "/propose-game",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  return routes;
}
