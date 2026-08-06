import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { popoverVariants } from '../motion/motion-config';
import { usePanelReducedMotion } from '../motion/motion-provider';

interface AdminDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function AdminDialog({ open, title, description, onClose, children }: AdminDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const shouldReduceMotion = usePanelReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      dialog.dataset.state = 'open';
      setIsVisible(true);
      return;
    }
    if (dialog.open) {
      dialog.dataset.state = 'closing';
      setIsVisible(false);
    }
  }, [open]);

  const finishClose = () => {
    const dialog = dialogRef.current;
    if (open || !dialog?.open) return;
    dialog.close();
    triggerRef.current?.focus();
  };

  return (
    <dialog ref={dialogRef} className="admin-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
      <AnimatePresence onExitComplete={finishClose}>
      {isVisible ? <m.div className="admin-dialog__surface" inert={!open} variants={popoverVariants(shouldReduceMotion, 8)} initial="initial" animate="animate" exit="exit">
      <div className="admin-dialog__header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="admin-dialog__body">{children}</div>
      </m.div> : null}
      </AnimatePresence>
    </dialog>
  );
}

export function MutationFeedback({ error, success }: { error?: Error | null; success?: string | null }) {
  if (error) {
    return <p className="mutation-feedback mutation-feedback--error" role="alert"><AlertCircle aria-hidden="true" />{error.message}</p>;
  }
  if (success) {
    return <p className="mutation-feedback mutation-feedback--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</p>;
  }
  return null;
}
