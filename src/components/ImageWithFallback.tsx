import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  onError,
  ...rest
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-[#17171F] text-[#A1A1AA] border border-white/10 ${className}`}
      >
        <ImageOff className="w-6 h-6 mb-2 text-[#8B5CF6]" aria-hidden="true" />
        <span className="text-xs text-center px-4 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
      className={className}
      {...rest}
    />
  );
}
