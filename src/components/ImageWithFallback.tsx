import React, { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  showSkeleton?: boolean;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  showSkeleton = false,
  onError,
  onLoad,
  ...rest
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(!showSkeleton);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(false);
    if (!showSkeleton) {
      setLoaded(true);
      return;
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src, showSkeleton]);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-700 border border-slate-300 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:border-white/10 ${className}`}
      >
        <ImageOff className="w-6 h-6 mb-2 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
        <span className="text-xs text-center px-4 line-clamp-2">{alt}</span>
      </div>
    );
  }

  if (!showSkeleton) {
    return (
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {!loaded && (
        <div
          aria-hidden="true"
          data-testid="image-skeleton-loader"
          className="absolute inset-0 skeleton-violet"
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setFailed(true);
          setLoaded(true);
          onError?.(e);
        }}
        className={`${className} transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...rest}
      />
    </div>
  );
}
