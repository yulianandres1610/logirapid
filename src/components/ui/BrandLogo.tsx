'use client';

import React from 'react';

interface BrandLogoProps {
  brand: string;
  size?: number;
  className?: string;
}

// Common car brands with their corresponding emoji representations or fallback text
const brandEmojis: { [key: string]: string } = {
  'toyota': '🚗',
  'honda': '🚙',
  'ford': '🚕',
  'chevrolet': '🚐',
  'bmw': '🏎️',
  'mercedes': '🏎️',
  'mercedes-benz': '🏎️',
  'audi': '🚗',
  'volkswagen': '🚗',
  'vw': '🚗',
  'nissan': '🚙',
  'mazda': '🚗',
  'subaru': '🚙',
  'hyundai': '🚗',
  'kia': '🚙',
  'lexus': '🚗',
  'infiniti': '🚙',
  'acura': '🚗',
  'volvo': '🚐',
  'tesla': '🚗',
  'gmc': '🚚',
  'ram': '🚐',
  'jeep': '🚙',
  'dodge': '🚗',
  'chrysler': '🚙',
  'buick': '🚗',
  'cadillac': '🚙',
  'lincoln': '🚗',
  'jaguar': '🏎️',
  'land rover': '🚙',
  'landrover': '🚙',
  'porsche': '🏎️',
  'ferrari': '🏎️',
  'lamborghini': '🏎️',
  'maserati': '🏎️',
  'bentley': '🚗',
  'rolls-royce': '🚙',
  'rollsroyce': '🚙',
  'mini': '🚗',
  'fiat': '🚙',
  'mitsubishi': '🚗',
  'suzuki': '🚙',
  'tata': '🚐',
  'mahindra': '🚚',
  'byd': '🚗',
  'geely': '🚙',
  'chery': '🚗',
  'proton': '🚙',
  'perodua': '🚗'
};

// Brand color mapping for gradient backgrounds
const brandColors: { [key: string]: { from: string; to: string } } = {
  'toyota': { from: '#eb0a1e', to: '#c40018' },
  'honda': { from: '#e60012', to: '#cc0010' },
  'ford': { from: '#003478', to: '#002860' },
  'chevrolet': { from: '#c41230', to: '#a00f28' },
  'bmw': { from: '#0066b1', to: '#005599' },
  'mercedes': { from: '#000000', to: '#333333' },
  'mercedes-benz': { from: '#000000', to: '#333333' },
  'audi': { from: '#d60606', to: '#b30505' },
  'volkswagen': { from: '#001948', to: '#001438' },
  'nissan': { from: '#c3002f', to: '#a00227' },
  'tesla': { from: '#cc0000', to: '#aa0000' },
  'hyundai': { from: '#002c5f', to: '#00234f' },
  'kia': { from: '#bb162b', to: '#991223' },
  'default': { from: '#6b7280', to: '#4b5563' }
};

export default function BrandLogo({ brand, size = 40, className = '' }: BrandLogoProps) {
  const normalizedBrand = brand.toLowerCase().trim();
  const emoji = brandEmojis[normalizedBrand] || '🚗';
  const colors = brandColors[normalizedBrand] || brandColors.default;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '2px solid rgba(255,255,255,0.1)',
        position: 'relative'
      }}
      title={`${brand} Logo`}
    >
      <span style={{
        filter: 'brightness(0) invert(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {emoji}
      </span>

      {/* Brand initials as fallback for better recognition */}
      {!brandEmojis[normalizedBrand] && (
        <span style={{
          position: 'absolute',
          fontSize: size * 0.25,
          fontWeight: 'bold',
          color: 'white',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
          filter: 'none'
        }}>
          {getBrandInitials(brand)}
        </span>
      )}
    </div>
  );
}

// Helper function to get brand initials for text fallback
export function getBrandInitials(brand: string): string {
  const normalizedBrand = brand.toUpperCase().trim();

  // Handle common multi-word brands
  if (normalizedBrand.includes('MERCEDES') || normalizedBrand.includes('MERCEDES-BENZ')) {
    return 'MB';
  }
  if (normalizedBrand.includes('LAND ROVER')) {
    return 'LR';
  }
  if (normalizedBrand.includes('ROLLS-ROYCE')) {
    return 'RR';
  }

  // For single words, take first 2-3 letters
  return normalizedBrand.slice(0, Math.min(3, normalizedBrand.length));
}