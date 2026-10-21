const RELEASES_URL = "https://api.github.com/repos/OleksandrShtyka/Dlightssite/releases?per_page=100";
const RELEASES_PAGE = "https://github.com/OleksandrShtyka/Dlightssite/releases";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`GitHub release lookup failed (${response.status})`);
    const releases = await response.json();
    const release = releases.find((item) => !item.draft && !item.prerelease && (item.assets || []).some((asset) => /^kadr-moviediary-v[\d.]+\.apk$/i.test(asset.name || "")));
    const apk = release?.assets?.find((asset) => /^kadr-moviediary-v[\d.]+\.apk$/i.test(asset.name || ""));
    if (!apk?.browser_download_url) return Response.redirect(RELEASES_PAGE, 302);
    return new Response(null, {
      status: 302,
      headers: { Location: apk.browser_download_url, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    return Response.redirect(RELEASES_PAGE, 302);
  }
}
