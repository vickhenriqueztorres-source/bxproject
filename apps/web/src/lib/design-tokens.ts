/**
 * BINMAX Design Tokens & Motion Physics Architecture
 * "A BINMAX É UM INSTRUMENTO DE PRECISÃO, NÃO UM CASSINO."
 */

export const PRECISION_SURFACES = {
  bg0: '#0B0E14',       // Fundo profundo da aplicação
  bg1: '#101622',       // Zona estrutural / navbar
  bg2: '#151D2B',       // Painel elevado
  bg3: '#1C2738',       // Campo, controle ativo
  line: 'rgba(138, 146, 161, 0.16)', // Divisor sutil e preciso

  // Compatibilidade legada
  bg: '#0B0E14',
  panel: '#101622',
  field: '#1C2738',
} as const;

export const PRECISION_TEXT = {
  strong: '#F4F5F7',
  main: '#DCE1EA',
  muted: '#8A92A1',
  quiet: '#596273',
} as const;

export const PRECISION_COLORS = {
  profit: '#22C47A',       // Verde Ganancia: Lucro real, confirmação, SUBE
  profitHover: '#1EB06D',
  loss: '#F2545B',         // Vermelho: Perda, erro, BAJA
  lossHover: '#DB434A',
  pending: '#E8A33D',      // Âmbar: Atenção, pendente
  info: '#4D8DFF',         // Azul: Telemetria de sistema
  metal: '#AEB8C8',        // Aço/Prata: Cor de trabalho institucional

  // Compatibilidade legada
  gain: '#22C47A',
  gainHover: '#1EB06D',
  system: '#4D8DFF',
  textPrimary: '#F4F5F7',
  textSecondary: '#8A92A1',
  borderSubtle: 'rgba(138, 146, 161, 0.16)',
} as const;

export const PRECISION_FONTS = {
  logo: "'Geist', sans-serif",
  sans: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'Geist Mono', 'JetBrains Mono', 'Roboto Mono', monospace",
} as const;

export const PRECISION_SPACING = {
  s4: '4px',
  s8: '8px',
  s12: '12px',
  s16: '16px',
  s24: '24px',
  s32: '32px',
  s48: '48px',
  s64: '64px',
} as const;

export const PRECISION_RADIUS = {
  structural: '8px',
  control: '6px',
  pill: '9999px',
} as const;

export const PRECISION_MOTION = {
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  tMicro: 100, // ms: hover, press, active
  tBase: 180,  // ms: modals, crossfade, tabs, dropdowns
  tEnter: 260, // ms: drawers, toast in, page block enter
  tCount: 500, // ms: numeric balance tick count
  distMax: 64, // px: maximum translation displacement
} as const;

/**
 * Retorna classe ou estilo de transição baseado nos tokens matemáticos.
 */
export function getMotionTransition(type: keyof typeof PRECISION_MOTION = 'tBase', properties = 'opacity, transform'): string {
  const duration = typeof PRECISION_MOTION[type] === 'number' ? `${PRECISION_MOTION[type]}ms` : '180ms';
  return `${properties} ${duration} ${PRECISION_MOTION.ease}`;
}
