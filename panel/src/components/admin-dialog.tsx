import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface AdminDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function AdminDialog({ open, title, description, onClose, children }: AdminDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="admin-dialog" aria-labelledby={titleId} onCancel={onClose} onClose={onClose}>
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
