import React, { useEffect, useState } from 'react';
import { CheckIcon, LoaderIcon } from 'lucide-react';
import { useNexus } from '../store/NexusContext';
import { Badge, Button, Modal, cn } from './ui/primitives';

const STEPS = [
'Discovering devices',
'Collecting configurations',
'Parsing configurations',
'Normalizing security model',
'Evaluating compliance',
'Checking network intent',
'Analyzing reachability',
'Building dependency graph',
'Detecting drift',
'Calculating risk',
'Generating AI analysis'];


interface Summary {
  before: number;
  after: number;
  devices: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  drift: number;
  thirdParty: number;
}

export function ScanModal({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const { runScan, hasData } = useNexus();
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setSummary(null);
      return;
    }
    if (!hasData) return;
    let cancelled = false;
    const tick = (i: number) => {
      if (cancelled) return;
      if (i >= STEPS.length) {
        const result = runScan('Manual network scan');
        if (result) setSummary(result);
        return;
      }
      setStep(i + 1);
      window.setTimeout(() => tick(i + 1), 190);
    };
    const start = window.setTimeout(() => tick(0), 120);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasData]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Network Security Scan"
      subtitle={summary ? 'Scan complete' : 'Running the full analysis pipeline'}
      footer={
      summary ?
      <Button variant="primary" onClick={onClose}>
            View console
          </Button> :

      <Button variant="ghost" onClick={onClose}>
            Run in background
          </Button>

      }>
      
      {!hasData ?
      <p className="text-sm text-muted">
          No devices are connected yet. Add a device, upload a configuration, or load the demo
          environment before running a scan.
        </p> :
      summary ?
      <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint">Devices</p>
              <p className="text-lg font-semibold tabular-nums text-ink">{summary.devices}</p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint">Critical</p>
              <p className="text-lg font-semibold tabular-nums text-critical">{summary.critical}</p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint">High</p>
              <p className="text-lg font-semibold tabular-nums text-high">{summary.high}</p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wider text-faint">Drift events</p>
              <p className="text-lg font-semibold tabular-nums text-ink">{summary.drift}</p>
            </div>
          </div>
          <div className="rounded-md border border-hairline bg-elevated px-3 py-3">
            <p className="text-2xs uppercase tracking-wider text-faint">Security score</p>
            <p className="mt-1 flex items-baseline gap-2 text-xl font-semibold tabular-nums">
              <span className="text-muted">{summary.before}</span>
              <span className="text-faint">→</span>
              <span className={summary.after < summary.before ? 'text-critical' : 'text-ok'}>
                {summary.after}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {summary.thirdParty} third-party risk{summary.thirdParty === 1 ? '' : 's'} ·{' '}
              {summary.medium} medium · {summary.low} low findings
            </p>
          </div>
        </div> :

      <ul className="space-y-2">
          {STEPS.map((label, i) => {
          const done = step > i + 1;
          const active = step === i + 1;
          return (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2.5 text-sm',
                done ? 'text-ink' : active ? 'text-ink' : 'text-faint'
              )}>
              
                {done ?
              <CheckIcon className="h-4 w-4 text-ok" /> :
              active ?
              <LoaderIcon className="h-4 w-4 animate-spin text-accent" /> :

              <span className="h-4 w-4 rounded-full border border-hairlineStrong" />
              }
                {label}
                {active && <Badge tone="accent">running</Badge>}
              </li>);

        })}
        </ul>
      }
    </Modal>);

}