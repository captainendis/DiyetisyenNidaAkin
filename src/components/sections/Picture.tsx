// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ImgHTMLAttributes } from 'react';

/** AVIF + WebP kaynaklı, boyutları belirtilmiş (CLS önleyici) görsel */
export function Picture({
  base, widths, width, height, alt, sizes, priority = false, className, imgClassName, position, style, ...rest
}: {
  base: string; widths: readonly number[]; width: number; height: number; alt: string; sizes: string; priority?: boolean; className?: string; imgClassName?: string;
  /** Panelde seçilen odak noktası (object-position) — varsa sınıftaki konumun önüne geçer */
  position?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height' | 'alt' | 'sizes'>) {
  const set = (ext: string) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
      <img
        src={`${base}-${widths[Math.min(1, widths.length - 1)]}.webp`}
        width={width}
        height={height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : undefined}
        className={imgClassName}
        style={position ? { ...style, objectPosition: position } : style}
        {...rest}
      />
    </picture>
  );
}
