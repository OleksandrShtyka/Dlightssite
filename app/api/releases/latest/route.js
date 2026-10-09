const RELEASE_URL = "https://api.github.com/repos/OleksandrShtyka/Dlightssite/releases/latest";
const RELEASES_PAGE = "https://github.com/OleksandrShtyka/Dlightssite/releases";

export const revalidate = 300;

export async function GET() {
  try {
    const response = await fetch(RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      next: { revalidate: 300 },
    });

    if (response.status === 404) {
      return Response.json({ available: false, notPublished: true, releasesUrl: RELEASES_PAGE }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    }
    if (!response.ok) throw new Error(`GitHub release lookup failed (${response.status})`);

    const release = await response.json();
    const apk = (release.assets || []).find((asset) => asset.name?.toLowerCase().endsWith(".apk"));
    return Response.json({
      available: Boolean(apk),
      version: release.tag_name || release.name || "Остання версія",
      publishedAt: release.published_at || null,
      downloadUrl: apk?.browser_download_url || null,
      fileName: apk?.name || null,
      size: apk?.size || null,
      releasesUrl: release.html_url || RELEASES_PAGE,
    }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ available: false, unavailable: true, releasesUrl: RELEASES_PAGE }, { status: 200, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  }
}
