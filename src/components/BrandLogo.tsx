import { useState } from 'react';
import { Bus } from 'lucide-react';
import { LOGO_URL } from '../utils/anteng';

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = 'w-16 h-16' }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 border-2 border-white shadow-sm`}
        aria-label="Logo TEMAN ANTENG"
      >
        <Bus className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <img
      src={LOGO_URL}
      alt="Logo TEMAN ANTENG Trans Jateng"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover bg-white shrink-0`}
    />
  );
}
