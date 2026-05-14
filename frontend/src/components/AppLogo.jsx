import React from 'react';

const LOGO_SRC = '/Blue-and-Green-Modern-Medical-Logo-2-scaled-removebg-preview.png';

export default function AppLogo({ size = 130, width, height, className = '', alt = 'AniCare Vox logo' }) {
  const finalWidth = width ?? size;
  const finalHeight = height ?? 'auto';
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      width={typeof finalWidth === 'number' ? finalWidth : undefined}
      height={typeof finalHeight === 'number' ? finalHeight : undefined}
      className={className}
      style={{ width: finalWidth, height: finalHeight, objectFit: 'contain' }}
      loading="eager"
      decoding="async"
    />
  );
}
