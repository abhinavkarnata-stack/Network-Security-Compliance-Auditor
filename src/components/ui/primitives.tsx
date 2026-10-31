import React from 'react';
import { twMerge } from 'tailwind-merge';
import { XIcon } from 'lucide-react';
import type { Severity } from '../../types/nexus';

export const cn = (...classes: (string | false | undefined | null)[]) => twMerge(classes.filter(Boolean).join(' '));

export const SEVERITY_STYLES: Record<Severity | 'PASS' | 'FAIL', string> = {
  CRITICAL: 'text-critical bg-critical/10 border-critical/30',
  HIGH: 'text-high bg-high/10 border-high/30',
  MEDIUM: 'text-medium bg-medium/10 border-medium/30',
  LOW: 'text-low bg-low/10 border-low/30',
  PASS: 'text-ok bg-ok/10 border-ok/30',
  FAIL: 'text-critical bg-critical/10 border-critical/30'
};

export function Badge({
  children,
  tone = 'neutral',
  className




}: {children: React.ReactNode;tone?: Severity | 'PASS' | 'FAIL' | 'neutral' | 'accent';className?: string;}) {
  const toneClass =
  tone === 'neutral' ?
  'text-muted bg-white/[0.04] border-hairlineStrong' :
  tone === 'accent' ?
  'text-accent bg-accentSoft border-accent/30' :
  SEVERITY_STYLES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
        toneClass,
        className
      )}>
      
      {children}
    </span>);

}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName







}: {title?: React.ReactNode;subtitle?: React.ReactNode;actions?: React.ReactNode;children: React.ReactNode;className?: string;bodyClassName?: string;}) {
  return (
    <section className={cn('rounded-card border border-hairline bg-surface', className)}>
      {(title || actions) &&
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      }
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>);

}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-accent text-white hover:bg-accent/90 border-accent',
    secondary: 'bg-elevated text-ink hover:bg-hairline border-hairlineStrong',
    ghost: 'bg-transparent text-muted hover:text-ink hover:bg-white/[0.04] border-transparent',
    danger: 'bg-critical/15 text-critical hover:bg-critical/25 border-critical/40'
  };
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variants[variant],
        className
      )}>
      
      {icon}
      {children}
    </button>);

}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  className






}: {label: string;value: React.ReactNode;hint?: React.ReactNode;tone?: 'neutral' | 'critical' | 'high' | 'medium' | 'ok' | 'accent';className?: string;}) {
  const tones: Record<string, string> = {
    neutral: 'text-ink',
    critical: 'text-critical',
    high: 'text-high',
    medium: 'text-medium',
    ok: 'text-ok',
    accent: 'text-accent'
  };
  return (
    <div className={cn('rounded-card border border-hairline bg-surface px-4 py-3', className)}>
      <p className="text-2xs font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>);

}

export function ScoreDial({
  score,
  label,
  size = 132




}: {score: number;label?: string;size?: number;}) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 85 ? '#38c793' : pct >= 70 ? '#e8c74a' : pct >= 50 ? '#ff9147' : '#ff4d5e';
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} role="img" aria-label={`${label ?? 'Score'} ${pct} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1e242f" strokeWidth={8} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 280ms cubic-bezier(0.23,1,0.32,1), stroke 280ms ease-out' }} />
        
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#e8ecf3"
          fontSize={size / 4}
          fontWeight={600}>
          
          {pct}
        </text>
        <text x="50%" y="66%" textAnchor="middle" fill="#5d6779" fontSize={11}>
          / 100
        </text>
      </svg>
      {label && <p className="mt-1 text-xs font-medium text-muted">{label}</p>}
    </div>);

}

export function MeterRow({
  label,
  value,
  invert = true




}: {label: string;value: number;invert?: boolean;}) {
  const color = invert ?
  value >= 60 ?
  'bg-critical' :
  value >= 40 ?
  'bg-high' :
  value >= 20 ?
  'bg-medium' :
  'bg-ok' :
  'bg-accent';
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value} / 100</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hairline">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${Math.max(2, value)}%`, transition: 'width 240ms cubic-bezier(0.23,1,0.32,1)' }} />
        
      </div>
    </div>);

}

export function EmptyState({
  title,
  description,
  actions,
  icon





}: {title: string;description: string;actions?: React.ReactNode;icon?: React.ReactNode;}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-hairlineStrong bg-surface px-6 py-14 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>);

}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-lg'








}: {open: boolean;onClose: () => void;title: string;subtitle?: string;children: React.ReactNode;footer?: React.ReactNode;width?: string;}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
      <div
        className={cn(
          'w-full rounded-card border border-hairlineStrong bg-surface shadow-2xl',
          width
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}>
        
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-faint transition-colors duration-150 ease-out hover:bg-white/[0.05] hover:text-ink">
            
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-hairline px-5 py-3">{footer}</footer>}
      </div>
    </div>);

}

export function Field({
  label,
  children,
  hint




}: {label: string;children: React.ReactNode;hint?: string;}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-faint">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>);

}

const controlClass =
'w-full rounded-md border border-hairlineStrong bg-canvas px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, 'pr-8', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, 'font-mono text-xs', props.className)} />;
}

export function Table({ children, className }: {children: React.ReactNode;className?: string;}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-full border-collapse text-sm', className)}>{children}</table>
    </div>);

}

export function Th({ children, className }: {children?: React.ReactNode;className?: string;}) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-hairline px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wider text-faint',
        className
      )}>
      
      {children}
    </th>);

}

export function Td({ children, className }: {children?: React.ReactNode;className?: string;}) {
  return (
    <td className={cn('border-b border-hairline/60 px-3 py-2.5 align-middle text-ink', className)}>
      {children}
    </td>);

}

export function KeyValue({ label, value, mono }: {label: string;value: React.ReactNode;mono?: boolean;}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-hairline/60 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-56 shrink-0 text-xs text-faint">{label}</span>
      <span className={cn('text-sm text-ink', mono && 'font-mono text-xs')}>{value}</span>
    </div>);

}

export function PageHeader({
  title,
  description,
  actions




}: {title: string;description?: string;actions?: React.ReactNode;}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>);

}

export function PathTrail({
  hops


}: {hops: {node: string;device?: string;ruleName?: string;decision?: string;}[];}) {
  return (
    <ol className="space-y-1.5">
      {hops.map((hop, i) =>
      <li key={`${hop.node}-${i}`} className="flex items-start gap-3">
          <span
          className={cn(
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            hop.decision === 'DENY' ? 'bg-critical' : hop.device ? 'bg-accent' : 'bg-faint'
          )} />
        
          <div className="min-w-0">
            <p className="text-sm text-ink">{hop.node}</p>
            {hop.device &&
          <p className="text-xs text-muted">
                {hop.decision === 'DENY' ? 'Blocked by' : 'Permitted by'}{' '}
                <span className="font-mono text-2xs text-ink">{hop.ruleName}</span>
              </p>
          }
          </div>
        </li>
      )}
    </ol>);

}