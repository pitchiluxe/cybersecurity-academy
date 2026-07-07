import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/login", priority: 0.8, changeFrequency: "monthly" },
    { path: "/register", priority: 0.8, changeFrequency: "monthly" },
    { path: "/courses", priority: 0.7, changeFrequency: "weekly" },
    { path: "/labs", priority: 0.6, changeFrequency: "monthly" },
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
