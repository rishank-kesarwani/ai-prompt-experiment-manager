# Vercel Image Optimization & Performance Architecture

## 1. Executive Summary & Transformation Economics

Vercel provides an included allowance of **5,000 source image transformations per billing cycle**. Each unique permutation of `(source_image_url, width, quality, format)` that is processed by the `/_next/image` endpoint consumes 1 transformation from this quota. Once the 5,000 limit is reached:
- Requests for new, uncached image transformations return HTTP errors (`402 Payment Required` or `500 Server Error`).
- The application risks broken images on newly visited pages, uncached viewports, or after deployments.

To safeguard production against transformation limits and ensure zero recurring transformation costs, this frontend implements a **Zero-Unnecessary-Transformation Architecture**:
1. **Static Vector Bypass**: All vector graphics (SVGs) and brand logos bypass Vercel's optimizer via `unoptimized: true`, serving directly from Vercel's global CDN as static files with zero transformation consumption.
2. **Automated Guardrails**: `dangerouslyAllowSVG: false` is enforced in `next.config.js` to block accidental SVG routing to the raster optimizer.
3. **Streamlined Permutations**: Responsive `deviceSizes` and `imageSizes` are pruned to align strictly with UI grid breakpoints, eliminating redundant legacy device widths (e.g. 750px, 828px).
4. **Format Standardization**: Formats are standardized to modern `image/webp`, avoiding dual AVIF + WebP transformation generation.
5. **Edge & Browser Caching**: Static assets are served with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` and edge caching `minimumCacheTTL: 2678400` (31 days).
6. **Graceful Error Fallbacks**: Local inline SVG fallback in `Logo.tsx` and error boundaries in `OptimizedImage.tsx` prevent broken image boxes even if network or quota failures occur.

---

## 2. Image Inventory & Delivery Strategy

| Asset | Type | Intrinsic Size | Display Sizes | Optimization Strategy | Transformations Used |
|---|---|---|---|---|---|
| `/logo.svg` | Vector SVG | 1.5 KB | 28px (`sm`), 36px (`md`), 48px (`lg`) | `unoptimized: true` via `<Image>` + Inline SVG fallback | **0** (Served statically) |
| `/icon.svg` | Vector SVG | 1.5 KB | Standard / App Icon | Direct static metadata route | **0** (Served statically) |
| `/favicon.ico` | Multi-size ICO | 1.0 KB | 16x16, 32x32 | Direct static serving for legacy browsers | **0** (Served statically) |
| UI Icons (`lucide-react`) | Inline React SVG | 0 KB network | 14px – 20px | Inline SVG components (`lucide-react`) | **0** (Zero HTTP requests) |

---

## 3. Configuration & Guardrails (`next.config.js`)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // 1. Standardize on modern WebP to prevent duplicate AVIF+WebP transformations
    formats: ['image/webp'],

    // 2. Maximum edge cache retention for any transformed assets (31 days)
    minimumCacheTTL: 2678400,

    // 3. Pruned device sizes aligned with Tailwind CSS breakpoints (sm: 640, md: 768, lg/xl: 1080, 2xl: 1920)
    // Eliminates redundant legacy iPhone widths (750, 828)
    deviceSizes: [640, 768, 1080, 1920],

    // 4. Targeted image sizes for UI elements and icons
    imageSizes: [16, 32, 48, 64, 128, 256],

    // 5. Hard guardrail: Prevent SVGs from ever entering the Vercel optimizer
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    // 6. Whitelist only authorized remote domains
    remotePatterns: [],
  },

  // 7. Edge & browser caching for static assets
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};
```

---

## 4. Fallback Architecture & Broken Image Prevention

When a team exhausts the 5,000 transformation ceiling on Vercel:
- Any `/_next/image` URL that was not previously cached returns an error.
- Static files served from `/public/` continue to function with 100% reliability because they bypass `/_next/image` completely.

### `Logo.tsx` Resilient Fallback Pattern
The brand logo uses `unoptimized: true` on `next/image` to serve `/logo.svg` statically. In addition, an `onError` listener renders an exact inline vector SVG fallback if network or edge anomalies occur:

```tsx
{!hasError ? (
  <Image
    src="/logo.svg"
    alt="AI Prompt Experiment & Release Manager Logo"
    width={dimensions.px}
    height={dimensions.px}
    priority
    unoptimized
    onError={() => setHasError(true)}
  />
) : (
  <svg viewBox="0 0 48 48" width={dimensions.px} height={dimensions.px} role="img" aria-label="PromptFlow Logo Fallback">
    {/* Inline vector paths */}
  </svg>
)}
```

### `OptimizedImage.tsx` Reusable Component
For adding new images or project thumbnails across the frontend, use `<OptimizedImage>`:
- Automatically detects `.svg` and sets `unoptimized: true`.
- Automatically marks small icons (`width <= 64` and `height <= 64`) as `unoptimized`.
- Provides an `onError` fallback element to prevent Cumulative Layout Shift (CLS) and avoid broken image boxes.

```tsx
import { OptimizedImage } from '@/components/OptimizedImage';

// Example: Static asset bypass
<OptimizedImage
  src="/thumbnails/project-preview.webp"
  alt="Project Preview"
  width={400}
  height={225}
  sizes="(max-width: 768px) 100vw, 400px"
  fallbackSrc="/thumbnails/project-preview.webp"
/>
```

---

## 5. Developer Guidelines: Adding New Assets Safely

Follow these rules when introducing new graphics to the repository:

1. **Icons and Glyphs**:
   - Always prefer `lucide-react` inline icons.
   - Do NOT import `.svg` files through `next/image` without `unoptimized: true`.
2. **Local Photography and Screenshots**:
   - Pre-convert raster images to `.webp` prior to committing (e.g. using `cwebp` or Squoosh).
   - Store static, pre-optimized WebP files in `public/`.
   - If using `next/image`, always provide explicit `sizes` (e.g. `sizes="(max-width: 640px) 100vw, 400px"`) so the browser does not request full 1920px variants on mobile screens.
3. **Avoid Plain `<img>` as a Blanket Hack**:
   - Plain `<img>` lacks Next.js intrinsic aspect ratio reservation and causes Cumulative Layout Shift (CLS).
   - Use `next/image` with `unoptimized: true` or the project's `<OptimizedImage>` component.
4. **Never Transform Remote Images Without Allowlist**:
   - Add only verified CDN domains to `remotePatterns` in `next.config.js`.
   - Never allow wildcard patterns (`*`) in `remotePatterns`.
5. **Verify Locally**:
   - Run `npm run build && npm run start`.
   - Inspect rendered DOM in DevTools: ensure `src` points directly to static files for SVGs and that no unwanted `/_next/image` requests appear in the Network tab.
