import React from 'react';

export interface SidebarIconProps {
  size?: number;
  color?: string;
  className?: string;
}

// 1. Operar (Candlestick chart)
export const IconOperar: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M7 3v3M7 17v4M17 3v6M17 19v2" />
    <rect x="4" y="6" width="6" height="11" rx="1.5" fill="rgba(34, 196, 122, 0.25)" stroke={color} />
    <rect x="14" y="9" width="6" height="10" rx="1.5" fill="rgba(242, 84, 91, 0.25)" stroke={color} />
  </svg>
);

// 2. Portafolio (Briefcase)
export const IconPortafolio: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <circle cx="12" cy="12" r="1" fill={color} />
  </svg>
);

// 3. Historial (Clock / time tracking)
export const IconHistorial: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
    <path d="M3 12a9 9 0 0 1 9-9" strokeDasharray="2 2" />
  </svg>
);

// 4. Torneos (Trophy)
export const IconTorneos: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v3h10v-3c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
    <path d="M6 4h12v6a6 6 0 0 1-12 0V4Z" />
  </svg>
);

// 4b. Arena (Diamond / Blitz competition)
export const IconArena: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2 22 8.5 12 22 2 8.5Z" />
    <path d="M2 8.5h20" />
    <path d="M12 2 8 8.5h8L12 2Z" />
    <path d="M12 22V8.5" />
  </svg>
);

// 5. Análisis (Market analysis / trends)
export const IconAnalisis: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 3v18h18" />
    <path d="m19 9-5 5-4-4-3 3" />
    <circle cx="19" cy="9" r="2" fill={color} />
  </svg>
);

// 6. Tutoriales (Graduation Cap / Video)
export const IconTutoriales: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

// 7. Promociones (Gift box)
export const IconPromociones: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect width="20" height="5" x="2" y="7" rx="1" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

// 8. Ajustes (Gear / configuration)
export const IconAjustes: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// 9. Billetera (Wallet)
export const IconBilletera: React.FC<SidebarIconProps> = ({ size = 20, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </svg>
);

// 10. Top Chevron Double (▲▲ / Header indicator)
export const IconChevronDouble: React.FC<SidebarIconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="18 15 12 9 6 15" />
    <polyline points="18 9 12 3 6 9" />
  </svg>
);

