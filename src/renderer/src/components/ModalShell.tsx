import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Plasma, PlasmaCanvas, PlasmaProvider } from '@cruxgarden/plasma-ui'
import type { AppearanceSettings } from '../../../shared/types'
import { paletteMood } from '../lib/appearance'
import { usePaletteBackdrop } from '../lib/usePaletteBackdrop'

interface ModalShellProps {
  appearance: AppearanceSettings
  title: string
  eyebrow?: string
  wide?: boolean
  onClose: () => void
  children: ReactNode
}

export function ModalShell({
  appearance,
  title,
  eyebrow,
  wide = false,
  onClose,
  children
}: ModalShellProps): React.JSX.Element {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  const modalBackdrop = usePaletteBackdrop(appearance.palette)
  const material = appearance.material

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const container = panelRef.current
    const selector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    window.setTimeout(() => container?.querySelector<HTMLElement>(selector)?.focus(), 30)

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !container) return
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.offsetParent !== null
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  return createPortal(
    <div className="modal-root" data-modal-backdrop="palette">
      <button
        type="button"
        className="modal-scrim"
        aria-label="关闭弹窗"
        onClick={onClose}
      />
      <PlasmaProvider
        mood={paletteMood(appearance.palette)}
        theme="light"
        background={modalBackdrop ?? undefined}
        ground="clear"
        canvas={false}
        blend={0}
        radius={26}
        tint="#ffffff"
        opacity={0.28}
        frost={Math.max(0.58, material.frost)}
        elevation={material.elevation + 0.15}
        backgroundBlur={0}
        refraction={material.refraction}
        dispersion={material.dispersion}
        highlight={material.highlight}
        viscosity={material.viscosity}
        rim={0.55}
        shimmer={0.25}
        glow={0}
        wash={0.35}
        grain={0}
        pointerDrop={false}
        pointerPull={false}
        quality={1}
        maxSurfaces={6}
      >
        <PlasmaCanvas className="modal-plasma" zIndex={1} />
        <Plasma
          as="section"
          className={`modal-panel ${wide ? 'wide' : ''}`}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          elevation={0.28}
          fuse={false}
          lean={false}
        >
          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
          >
            <span className="modal-close-visual" aria-hidden="true">
              ✕
            </span>
          </button>
          <header className="modal-header">
            <div>
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              <h2>{title}</h2>
            </div>
          </header>
          {children}
        </Plasma>
      </PlasmaProvider>
    </div>,
    document.body
  )
}

