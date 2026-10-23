'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const dimensions = {
    sm: { px: 28, text: 'text-base', sub: 'text-[10px]' },
    md: { px: 36, text: 'text-lg', sub: 'text-xs' },
    lg: { px: 48, text: 'text-2xl', sub: 'text-sm' },
  }[size];

  return (
    <div className={`shrink-0 flex items-center ${showText ? 'gap-3' : ''} ${className}`}>
      <div className="relative shrink-0 group">
        <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 opacity-40 blur group-hover:opacity-75 transition duration-300 pointer-events-none" />
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-900 shadow-xl flex items-center justify-center p-0.5">
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
            /* Resilient inline SVG fallback if static network fetch encounters an edge error */
            <svg
              viewBox="0 0 48 48"
              width={dimensions.px}
              height={dimensions.px}
              fill="none"
              aria-label="PromptFlow Logo Fallback"
              role="img"
            >
              <defs>
                <linearGradient id="fallbackPrimaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="fallbackAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="40" height="40" rx="10" fill="#0f172a" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
              <path d="M14 17L20 23L14 29" stroke="url(#fallbackPrimaryGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M24 31H34" stroke="url(#fallbackAccentGrad)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="28" cy="18" r="3.5" fill="url(#fallbackPrimaryGrad)" />
              <circle cx="36" cy="18" r="3.5" fill="url(#fallbackAccentGrad)" />
              <path d="M28 21.5V25C28 27.5 34 27.5 34 30" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2" />
            </svg>
          )}
        </div>
      </div>
      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className={`font-bold tracking-tight text-white ${dimensions.text} shrink-0`}>
              PromptFlow
            </span>
            <span className="hidden xs:inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase tracking-wider shrink-0">
              Release Manager
            </span>
          </div>
          <span className={`text-slate-400 font-medium ${dimensions.sub} hidden xl:inline-block truncate max-w-[280px]`}>
            Controlled A/B Experiments & Staged AI Delivery
          </span>
        </div>
      )}
    </div>
  );
};
