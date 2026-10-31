import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, LoaderIcon, UploadIcon } from 'lucide-react';
import { SAMPLE_UPLOADS } from '../data/rawConfigs';
import { detectVendor } from '../engine/parsers';
import { useNexus } from '../store/NexusContext';
import type { Configuration, Environment, Vendor } from '../types/nexus';
import { Badge, Button, Field, Input, Modal, Select, Textarea, cn } from './ui/primitives';

const VENDORS: Vendor[] = ['Cisco', 'Fortinet', 'Juniper', 'Palo Alto'];
const ENVIRONMENTS: Environment[] = ['Production', 'Development', 'DMZ', 'Cloud'];
const PIPELINE = ['Uploading', 'Detecting vendor', 'Parsing', 'Normalizing', 'Ready for audit'];

export function UploadConfigModal({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const { db, orgId, uploadConfiguration, runScan } = useNexus();
  const navigate = useNavigate();
  const devices = db.devices.filter((d) => d.orgId === orgId);

  const [vendorChoice, setVendorChoice] = useState<'auto' | Vendor>('auto');
  const [deviceId, setDeviceId] = useState('new');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [ip, setIp] = useState('');
  const [environment, setEnvironment] = useState<Environment>('Production');
  const [raw, setRaw] = useState('');
  const [fileName, setFileName] = useState('');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<Configuration | null>(null);
  const [error, setError] = useState('');

  const detection = useMemo(() => raw ? detectVendor(raw) : null, [raw]);

  useEffect(() => {
    if (!open) {
      setStage(0);
      setResult(null);
      setError('');
      setRaw('');
      setFileName('');
      setVendorChoice('auto');
      setDeviceId('new');
      setNewDeviceName('');
    }
  }, [open]);

  const readFile = async (file: File) => {
    if (!/\.(cfg|conf|txt|set|xml|log|json)$/i.test(file.name)) {
      setError('Only text configuration exports are accepted (.cfg, .conf, .txt, .set, .xml, .json).');
      return;
    }
    if (file.size > 400_000) {
      setError('File exceeds the 400KB validation limit.');
      return;
    }
    const text = await file.text();
    setRaw(text);
    setFileName(file.name);
    setError('');
  };

  const start = () => {
    setError('');
    const vendor = vendorChoice === 'auto' ? detection?.vendor ?? undefined : vendorChoice;
    if (!raw.trim()) {
      setError('Select or paste a configuration file first.');
      return;
    }
    if (!vendor) {
      setError('Vendor could not be detected — choose one explicitly.');
      return;
    }
    if (deviceId === 'new' && !newDeviceName.trim()) {
      setError('Name the new device or select an existing one.');
      return;
    }

    let step = 0;
    setStage(1);
    const advance = () => {
      step += 1;
      if (step < PIPELINE.length) {
        setStage(step + 1);
        window.setTimeout(advance, 320);
      } else {
        const created = uploadConfiguration({
          raw,
          fileName: fileName || 'pasted-configuration.cfg',
          vendor,
          deviceId: deviceId === 'new' ? undefined : deviceId,
          newDeviceName: newDeviceName.trim(),
          environment,
          ip: ip.trim() || undefined
        });
        if (created) setResult(created);else
        setStage(0);
      }
    };
    window.setTimeout(advance, 320);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Upload Configuration"
      subtitle="Vendor detection → parse → normalize → audit"
      footer={
      result ?
      <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
          variant="primary"
          onClick={() => {
            runScan(`Audit after upload · ${result.deviceName}`);
            onClose();
            navigate(`/configurations/${result.id}`);
          }}>
          
              Run Security Audit
            </Button>
          </> :

      <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={start} disabled={stage > 0}>
              Upload &amp; Parse
            </Button>
          </>

      }>
      
      {stage === 0 ?
      <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vendor">
              <Select
              value={vendorChoice}
              onChange={(e) => setVendorChoice(e.target.value as 'auto' | Vendor)}>
              
                <option value="auto">Auto-detect</option>
                {VENDORS.map((v) =>
              <option key={v} value={v}>
                    {v}
                  </option>
              )}
              </Select>
            </Field>
            <Field label="Device">
              <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                <option value="new">Create new device</option>
                {devices.map((d) =>
              <option key={d.id} value={d.id}>
                    {d.name} · {d.vendor}
                  </option>
              )}
              </Select>
            </Field>
            {deviceId === 'new' &&
          <>
                <Field label="New device name">
                  <Input
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="Fortinet-FW-06" />
              
                </Field>
                <Field label="Management IP (optional)">
                  <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.11" />
                </Field>
              </>
          }
            <Field label="Environment">
              <Select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as Environment)}>
              
                {ENVIRONMENTS.map((e) =>
              <option key={e}>{e}</option>
              )}
              </Select>
            </Field>
          </div>

          <Field label="Configuration file">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-hairlineStrong bg-canvas px-4 py-6 text-sm text-muted transition-colors duration-150 ease-out hover:border-accent/60 hover:text-ink">
              <UploadIcon className="h-4 w-4" />
              {fileName || 'Choose a configuration export'}
              <input
              type="file"
              className="sr-only"
              accept=".cfg,.conf,.txt,.set,.xml,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }} />
            
            </label>
          </Field>

          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-faint">
              Or use a sample export
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_UPLOADS.map((s) =>
            <Button
              key={s.fileName}
              size="sm"
              onClick={() => {
                setRaw(s.raw);
                setFileName(s.fileName);
                setError('');
              }}>
              
                  {s.label}
                </Button>
            )}
            </div>
          </div>

          <Field label="Raw configuration" hint="Uploaded files are validated as text and never executed.">
            <Textarea
            rows={6}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste configuration text…" />
          
          </Field>

          {detection?.vendor &&
        <p className="text-xs text-muted">
              Detected <Badge tone="accent">{detection.vendor}</Badge> with{' '}
              {Math.round(detection.confidence * 100)}% syntax confidence.
            </p>
        }
          {error &&
        <p role="alert" className="text-xs text-critical">
              {error}
            </p>
        }
        </div> :

      <div className="space-y-4">
          <ul className="space-y-2">
            {PIPELINE.map((label, i) => {
            const done = stage > i + 1 || result && i === PIPELINE.length - 1;
            const active = stage === i + 1 && !done;
            return (
              <li
                key={label}
                className={cn('flex items-center gap-2.5 text-sm', done || active ? 'text-ink' : 'text-faint')}>
                
                  {done ?
                <CheckIcon className="h-4 w-4 text-ok" /> :
                active ?
                <LoaderIcon className="h-4 w-4 animate-spin text-accent" /> :

                <span className="h-4 w-4 rounded-full border border-hairlineStrong" />
                }
                  {label}
                </li>);

          })}
          </ul>

          {result &&
        <div className="rounded-md border border-hairline bg-elevated px-3 py-3 text-sm">
              <p className="font-medium text-ink">
                {result.deviceName} · {result.vendor} · v{result.version}
              </p>
              <p className="mt-1 text-xs text-muted">
                {result.normalized.interfaces.length} interfaces ·{' '}
                {result.normalized.firewallRules.length} policy rules ·{' '}
                {result.normalized.zones.length} zones · {result.normalized.secretsRedacted} secret
                value(s) detected and redacted
              </p>
            </div>
        }
        </div>
      }
    </Modal>);

}