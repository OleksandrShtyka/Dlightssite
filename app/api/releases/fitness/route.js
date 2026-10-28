const RELEASE_URL = "https://api.github.com/repos/OleksandrShtyka/Dlightssite/releases?per_page=100";
const RELEASES_PAGE = "https://github.com/OleksandrShtyka/Dlightssite/releases";
const FITNESS_APK = /^(?:autochecker|autochecker-mobile|gym.?tracker|fitness)[a-z0-9._-]*\.apk$/i;

export const revalidate = 300;

export async function GET() {
  try {
    const response = await fetch(RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`Release lookup failed (${response.status})`);
    const releases = await response.json();
    const apk = releases
      .filter((release) => !release.draft && !release.prerelease)
      .flatMap((release) => release.assets || [])
      .find((asset) => FITNESS_APK.test(asset.name || ""));
    return Response.redirect(apk?.browser_download_url || RELEASES_PAGE, 302);
  } catch {
    return Response.redirect(RELEASES_PAGE, 302);
  }
}
