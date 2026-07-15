/**
 * @file theme.js
 * @description نظام تصميم موحّد لتطبيق "مندوب المبيعات" — نفس بنية theme.js
 * بتطبيق التاجر المتنقل، بهوية لونية بنفسجية مميّزة.
 */
export const T = {
  primary: '#7C3AED',
  primaryDark: '#5B21B6',
  primaryLight: '#F5F3FF',
  primaryGradient: 'linear-gradient(135deg,#8B5CF6,#5B21B6)',
  success: '#059669',
  danger: '#DC2626',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  info: '#1565C0',
  text: '#0D1B2A',
  textSoft: '#64748B',
  textFaint: '#94A3B8',
  bg: '#F8FAFC',
  border: '#EEF1F5',
  card: {
    background: 'white',
    borderRadius: 20,
    boxShadow: '0 2px 16px rgba(15,23,42,.06)',
  },
  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 20,
  radiusPill: 999,
}

export const cardStyle = { ...T.card, padding: 16 }

export const buttonPrimary = {
  background: T.primaryGradient,
  color: 'white',
  border: 'none',
  borderRadius: T.radiusMd,
  fontWeight: 800,
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(124,58,237,.28)',
  transition: 'transform .12s ease, box-shadow .12s ease',
}

export const buttonGhost = {
  background: T.bg,
  color: T.textSoft,
  border: 'none',
  borderRadius: T.radiusMd,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

export const offlineBannerStyle = {
  background: T.warningBg,
  color: T.warning,
  textAlign: 'center',
  fontSize: 12.5,
  fontWeight: 700,
  padding: '8px 12px',
}

export const inputStyle = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: T.radiusMd,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'white',
  outline: 'none',
}
