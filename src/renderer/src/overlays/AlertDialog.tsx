import type { AppearanceSettings } from '../../../shared/types'
import { GlassButton } from '../components/GlassControls'
import { ModalShell } from '../components/ModalShell'

export interface AlertState {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void | Promise<void>
}

interface AlertDialogProps {
  appearance: AppearanceSettings
  state: AlertState
  onClose: () => void
}

export function AlertDialog({
  appearance,
  state,
  onClose
}: AlertDialogProps): React.JSX.Element {
  return (
    <ModalShell appearance={appearance} title={state.title} eyebrow="提示" onClose={onClose}>
      <div className="alert-body">
        <p>{state.message}</p>
      </div>
      <footer className="modal-footer end">
        {state.onConfirm && (
          <GlassButton size="sm" onClick={onClose}>
            {state.cancelLabel ?? '取消'}
          </GlassButton>
        )}
        <GlassButton
          size="sm"
          onClick={async () => {
            if (state.onConfirm) await state.onConfirm()
            onClose()
          }}
        >
          {state.onConfirm ? (state.confirmLabel ?? '确定') : '知道了'}
        </GlassButton>
      </footer>
    </ModalShell>
  )
}

