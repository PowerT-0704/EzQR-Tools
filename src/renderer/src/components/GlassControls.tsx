import type { ComponentProps } from 'react'
import { PlasmaButton, PlasmaSlider } from '@cruxgarden/plasma-ui'

export function GlassButton(
  props: ComponentProps<typeof PlasmaButton>
): React.JSX.Element {
  return <PlasmaButton {...props} fuse={false} />
}

export function GlassSlider(
  props: ComponentProps<typeof PlasmaSlider>
): React.JSX.Element {
  return <PlasmaSlider {...props} fuse={false} />
}

