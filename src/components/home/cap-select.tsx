"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "none";

export function CapSelect<Option extends number>({
  options,
  value,
  label,
  format,
  noneLabel,
  className,
  onChange,
}: {
  options: readonly Option[];
  value: Option | null;
  label: string;
  format: (option: Option) => string;
  /** Offered as the first choice when the cap can be switched off. */
  noneLabel?: string;
  className?: string;
  onChange: (value: Option | null) => void;
}) {
  return (
    <Select
      value={value == null ? NONE : String(value)}
      onValueChange={(next) =>
        onChange(options.find((option) => String(option) === next) ?? null)
      }
    >
      <SelectTrigger className={className} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {format(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
