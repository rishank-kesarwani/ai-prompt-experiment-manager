/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Standardize to modern WebP format instead of multiple variants (e.g. AVIF + WebP)
    // to prevent duplicate transformation counts per image asset.
    formats: ['image/webp'],
    // Cache transformed image assets at edge for 31 days (in seconds) to prevent frequent cache revalidation
    minimumCacheTTL: 2678400,
    // Sensible device and image sizes to avoid generating excessive width permutations
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Security and format handling
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Explicit remote patterns: no unauthorized remote hosts allowed to trigger transformations
    remotePatterns: [],
  },
};

module.exports = nextConfig;
