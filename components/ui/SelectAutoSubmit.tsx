"use client";
export function SelectAutoSubmit({ name, defaultValue, className, ariaLabel, children }:
  { name: string; defaultValue: string; className: string; ariaLabel: string; children: React.ReactNode }) {
  return (
    <select name={name} defaultValue={defaultValue} className={className} aria-label={ariaLabel}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
