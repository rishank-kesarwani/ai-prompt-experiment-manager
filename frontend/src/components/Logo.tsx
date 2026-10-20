'use client';

import React from 'react';
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
          <Image
            src="/logo.svg"
            alt="AI Prompt Experiment & Release Manager Logo"
            width={dimensions.px}
            height={dimensions.px}
            priority
            unoptimized
          />
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
