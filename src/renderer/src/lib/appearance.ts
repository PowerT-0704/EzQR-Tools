import type { CSSProperties } from 'react'
import type { Mood } from '@cruxgarden/plasma-ui'
import type { MaterialSettings, PaletteName } from '../../../shared/types'
import { MATERIAL_LIMITS } from '../../../shared/constants'

interface PaletteDefinition {
  label: string
  description: string
  mood: Mood
  accent: string
  accentEnd: string
  accentSoft: string
  swatches: [string, string, string]
}

const SPRING = { stiffness: 150, damping: 18 }

export const PALETTE_DEFINITIONS: Record<PaletteName, PaletteDefinition> = {
  mistBlue: {
    label: '晨雾蓝',
    description: '清透的蓝灰晨雾',
    mood: {
      colors: ['#f8fbff', '#dceaff', '#cadfff'],
      blend: 0,
      spring: SPRING
    },
    accent: '#4b73e8',
    accentEnd: '#7c66d9',
    accentSoft: 'rgb(75 115 232 / 13%)',
    swatches: ['#f8fbff', '#dceaff', '#cadfff']
  },
  sakuraPink: {
    label: '樱花粉',
    description: '柔和的粉紫暖光',
    mood: {
      colors: ['#fff9fc', '#ffe6ef', '#eadfff'],
      blend: 0,
      spring: SPRING
    },
    accent: '#df6e9f',
    accentEnd: '#9b72da',
    accentSoft: 'rgb(223 110 159 / 13%)',
    swatches: ['#fff9fc', '#ffe6ef', '#eadfff']
  },
  mintGreen: {
    label: '薄荷青',
    description: '清爽的薄荷与水蓝',
    mood: {
      colors: ['#f7fffc', '#dcf5ec', '#d9eaff'],
      blend: 0,
      spring: SPRING
    },
    accent: '#269f88',
    accentEnd: '#4f83da',
    accentSoft: 'rgb(38 159 136 / 13%)',
    swatches: ['#f7fffc', '#dcf5ec', '#d9eaff']
  }
}

export const DEFAULT_MATERIAL: MaterialSettings = {
  backgroundBlur: MATERIAL_LIMITS.backgroundBlur.default,
  refraction: MATERIAL_LIMITS.refraction.default,
  dispersion: MATERIAL_LIMITS.dispersion.default,
  highlight: MATERIAL_LIMITS.highlight.default,
  frost: MATERIAL_LIMITS.frost.default,
  elevation: MATERIAL_LIMITS.elevation.default,
  viscosity: MATERIAL_LIMITS.viscosity.default
}

export function paletteStyle(palette: PaletteName): CSSProperties {
  const definition = PALETTE_DEFINITIONS[palette]
  return {
    '--accent': definition.accent,
    '--accent-end': definition.accentEnd,
    '--accent-soft': definition.accentSoft
  } as CSSProperties
}

export function paletteMood(palette: PaletteName): Mood {
  return PALETTE_DEFINITIONS[palette].mood
}

