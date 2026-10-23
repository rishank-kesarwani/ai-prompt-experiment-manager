'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';

export interface OptimizedImageProps extends Omit<ImageProps, 'onError'> {
  /**
   * Fallback image source or element to display if image transformation or loading fails.
   * Useful when Vercel image optimization transformation allowance has been exhausted.
   */
  fallbackSrc?: string;
  fallbackElement?: React.ReactNode;
  /**
   * By default, vector SVGs and small thumbnails (<= 64px) automatically bypass
   * the Vercel Image Optimization loader to conserve monthly transformation allowances.
   * Set forceOptimize to true if you explicitly want Vercel transformation for this asset.
   */
  forceOptimize?: boolean;
}

/**
 * OptimizedImage
 * Enterprise wrapper around next/image that prevents unnecessary Vercel image transformations,
 * enforces sensible sizes, and provides fail-safe error handling when transformation allowances
 * are exhausted.
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes,
  unoptimized,
  forceOptimize = false,
  fallbackSrc,
  fallbackElement,
  className = '',
  ...rest
}) => {
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Check if asset is an SVG or small icon (<= 64px) which should not hit Vercel's optimizer
  const isSvg = typeof src === 'string' && src.toLowerCase().split('?')[0].endsWith('.svg');
  const isSmallIcon =
    typeof width === 'number' && typeof height === 'number' && width <= 64 && height <= 64;

  const shouldBypassOptimization =
    unoptimized || (!forceOptimize && (isSvg || isSmallIcon));

  // Default responsive sizes to prevent downloading full-bleed variants on standard layouts
  const effectiveSizes =
    sizes ||
    (!shouldBypassOptimization && !width
      ? '(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw'
      : undefined);

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    if (fallbackElement) {
      return <>{fallbackElement}</>;
    }
    // Graceful placeholder preserving layout dimensions to prevent Cumulative Layout Shift (CLS)
    return (
      <div
        className={`bg-slate-800/80 border border-white/10 rounded flex items-center justify-center text-slate-500 text-xs ${className}`}
        style={{
          width: width ? `${width}px` : '100%',
          height: height ? `${height}px` : '100%',
          minHeight: !height ? '48px' : undefined,
        }}
        role="img"
        aria-label={alt || 'Image failed to load'}
      >
        <span className="truncate px-2">{alt || 'Image unavailable'}</span>
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={effectiveSizes}
      unoptimized={shouldBypassOptimization}
      onError={handleError}
      className={className}
      {...rest}
    />
  );
};
