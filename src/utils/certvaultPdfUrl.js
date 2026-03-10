/** Use proxy for Cloudinary PDF URLs to bypass free-tier 401 on direct delivery. */
export function pdfDownloadUrl(url, forceDownload = false) {
  if (!url) return url;
  if (url.includes('res.cloudinary.com')) {
    const downloadParam = forceDownload ? '&download=1' : '';
    return `/api/certvault?action=proxy-pdf&url=${encodeURIComponent(url)}${downloadParam}`;
  }
  return url;
}
