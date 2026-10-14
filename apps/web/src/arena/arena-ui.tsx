import React, { useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  style,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={style}
      className={cn(
        'platform-rise flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6',
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

interface DialogContextValue {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({ open: false });

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <div
      data-slot="dialog-portal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        data-slot="dialog-overlay"
        onClick={() => onOpenChange?.(false)}
        className="fixed inset-0 bg-background/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        className={cn(
          'bm-modal-scale relative z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-surface p-6 text-sm text-foreground shadow-2xl outline-none sm:max-w-md',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            data-slot="dialog-close"
            onClick={() => onOpenChange?.(false)}
            aria-label="Fechar"
            className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-raised hover:text-foreground"
          >
            <X className="size-4" />
            <span className="sr-only">Fechar</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function DialogTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn('text-base leading-none font-semibold', className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    >
      {children}
    </p>
  );
}
