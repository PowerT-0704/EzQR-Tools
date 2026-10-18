import type { ReactNode } from 'react'
import { PlasmaCanvas, PlasmaProvider } from '@cruxgarden/plasma-ui'
import type { AppearanceSettings } from '../../../shared/types'
import { paletteMood } from '../lib/appearance'
import { useSoftBackground } from '../lib/useSoftBackground'

interface PlasmaShellProps {
  appearance: AppearanceSettings
  backgroundImageUrl: string
  children: ReactNode
}

export function PlasmaShell({
  appearance,
  backgroundImageUrl,
  children
}: PlasmaShellProps): React.JSX.Element {
  const material = appearance.material
  const softBackground = useSoftBackground(backgroundImageUrl)
  return (
    <PlasmaProvider
      mood={paletteMood(appearance.palette)}
      theme="light"
      background={softBackground ?? undefined}
      blend={0}
      radius={24}
      tint="#ffffff"
      opacity={0.18}
      frost={material.frost}
      elevation={material.elevation}
      backgroundBlur={material.backgroundBlur}
      refraction={material.refraction}
      dispersion={material.dispersion}
      highlight={material.highlight}
      viscosity={material.viscosity}
      stretch={0.35}
      flow={0.04}
      rim={0.55}
      rimWidth={0.7}
      shimmer={0.22}
      glow={0.55}
      wash={0.32}
      grain={0.04}
      pointerDrop={false}
      pointerPull
      quality={1}
      maxSurfaces={12}
      preserveDrawingBuffer
      canvas={false}
    >
      <PlasmaCanvas className="plasma-ground" zIndex={-1} />
      <div
        className="plasma-appearance"
        data-palette={appearance.palette}
        data-background-blur={material.backgroundBlur}
        data-refraction={material.refraction}
        data-dispersion={material.dispersion}
      >
        {children}
      </div>
    </PlasmaProvider>
  )
}

