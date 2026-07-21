import * as React from "react";
import { cn } from "@/lib/utils";
import { maskCurrencyInput, parseDigitsToNumber } from "@/lib/currency";

interface CurrencyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> {
  value: number;
  onValueChange: (value: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, ...props }, ref) => {
    const display = maskCurrencyInput(String(Math.round((value || 0) * 100)));

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
          R$
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          onChange={(e) => {
            const next = parseDigitsToNumber(e.target.value);
            onValueChange(next);
          }}
          onFocus={(e) => {
            // Place cursor at the end so typing always appends
            const v = e.target.value;
            requestAnimationFrame(() => e.target.setSelectionRange(v.length, v.length));
          }}
          className={cn(
            "font-mono-tabular flex h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-right text-base font-semibold tracking-tight shadow-sm transition-all placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
