"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// A destructive icon button that asks inline before acting, instead of a blocking window.confirm.
// The caller moves focus after onConfirm, since the confirmed item usually unmounts.
export function ConfirmButton({
  label,
  confirmLabel,
  warning,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  warning?: string;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const hasAskedRef = useRef(false);
  const promptId = useId();

  useEffect(() => {
    if (asking) {
      hasAskedRef.current = true;
      cancelRef.current?.focus();
    } else if (hasAskedRef.current) {
      triggerRef.current?.focus();
    }
  }, [asking]);

  function cancelOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") setAsking(false);
  }

  if (!asking) {
    return (
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        onClick={() => setAsking(true)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p id={promptId} className="basis-full text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}?</span> {warning}
      </p>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        aria-describedby={promptId}
        onKeyDown={cancelOnEscape}
        onClick={() => {
          hasAskedRef.current = false;
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button
        ref={cancelRef}
        type="button"
        variant="ghost"
        size="sm"
        aria-describedby={promptId}
        onKeyDown={cancelOnEscape}
        onClick={() => setAsking(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
