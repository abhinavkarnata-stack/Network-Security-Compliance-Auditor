import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useNexus } from '../store/NexusContext';
import type { Environment, NetworkIntent, PolicyAction, Protocol, Zone } from '../types/nexus';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Table,
  Td,
  Th,
  cn } from
'../components/ui/primitives';

const ZONES: Zone[] = ['Internet', 'DMZ', 'Application', 'Database', 'Management', 'Vendor', 'Cloud'];
const ENVIRONMENTS: Environment[] = ['Production', 'Development', 'DMZ', 'Cloud'];
const PRIORITIES: NetworkIntent['priority'][] = ['Critical', 'High', 'Medium', 'Low'];

export function NetworkIntentPage() {
  const { analysis, addIntent, deleteIntent } = useNexus();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    source: 'Internet' as Zone,
    destination: 'Database' as Zone,
    protocol: 'tcp' as Protocol,
    port: '3306',
    action: 'DENY' as PolicyAction,
    environment: 'Production' as Environment,
    priority: 'Critical' as NetworkIntent['priority'],
    description: ''
  });

  const evaluations = analysis.intentEvaluations;
  const violations = evaluations.filter((e) => !e.compliant);
  const segmentation = analysis.segmentation;

  return (
    <>
      <PageHeader
        title="Network Intent"
        description="Declare what the network SHOULD allow. Every rule is continuously compared against what the configuration actually does."
        actions={
        <Button variant="primary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Create Intent
          </Button>
        } />
      

      {!evaluations.length ?
      <EmptyState
        title="No intent defined"
        description="Define at least one intended flow so NEXUS can compare intended behaviour with actual behaviour."
        actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
              Create Intent
            </Button>
        } /> :


      <>
          <Panel
          title="Intent vs actual"
          subtitle={`${violations.length} of ${evaluations.length} intended flows do not match effective network behaviour`}
          bodyClassName="p-0">
          
            <Table>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>Destination</Th>
                  <Th>Service</Th>
                  <Th>Intent</Th>
                  <Th>Actual</Th>
                  <Th>Environment</Th>
                  <Th>Priority</Th>
                  <Th>Result</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {evaluations.map((e) =>
              <tr key={e.intent.id} className="transition-colors duration-150 ease-out hover:bg-white/[0.03]">
                    <Td>{e.intent.source}</Td>
                    <Td>{e.intent.destination}</Td>
                    <Td className="font-mono text-xs text-muted">
                      {e.intent.protocol.toUpperCase()}/{e.intent.port}
                    </Td>
                    <Td>
                      <Badge tone={e.expected === 'DENY' ? 'PASS' : 'accent'}>{e.expected}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={e.actual === e.expected ? 'PASS' : 'FAIL'}>{e.actual}</Badge>
                    </Td>
                    <Td className="text-muted">{e.intent.environment}</Td>
                    <Td className="text-muted">{e.intent.priority}</Td>
                    <Td>
                      {e.compliant ?
                  <span className="text-xs text-ok">enforced</span> :

                  <span className="text-xs text-critical">
                          {e.expected === 'DENY' ? 'INTENT VIOLATION' : 'not implemented'}
                        </span>
                  }
                    </Td>
                    <Td>
                      <button
                    onClick={() => deleteIntent(e.intent.id)}
                    className="rounded p-1 text-faint transition-colors duration-150 ease-out hover:text-critical"
                    aria-label={`Delete intent ${e.intent.source} to ${e.intent.destination}`}>
                    
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  </tr>
              )}
              </tbody>
            </Table>
          </Panel>

          {violations.length > 0 &&
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {violations.map((v) =>
          <Panel
            key={v.intent.id}
            title={`${v.intent.source} → ${v.intent.destination} · ${v.intent.protocol.toUpperCase()}/${v.intent.port}`}
            subtitle={v.intent.description}>
            
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-md border border-hairline bg-elevated px-3 py-2">
                      <p className="text-2xs uppercase tracking-wider text-faint">Intent</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{v.expected}</p>
                    </div>
                    <div className="rounded-md border border-critical/40 bg-critical/10 px-3 py-2">
                      <p className="text-2xs uppercase tracking-wider text-critical/80">Actual</p>
                      <p className="mt-1 text-sm font-semibold text-critical">{v.actual}</p>
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-xs text-muted">{v.pathText}</p>
                  <Link
              to="/findings"
              className="mt-3 inline-block text-xs text-accent hover:underline">
              
                    Open related findings
                  </Link>
                </Panel>
          )}
            </div>
        }

          <Panel
          className="mt-4"
          title="Segmentation matrix"
          subtitle="Effective zone-to-zone behaviour probed against declared intent">
          
            <div className="overflow-x-auto">
              <table className="border-collapse text-2xs">
                <thead>
                  <tr>
                    <th className="p-1.5 text-left text-faint">from → to</th>
                    {ZONES.map((z) =>
                  <th key={z} className="p-1.5 text-left font-medium text-faint">
                        {z}
                      </th>
                  )}
                  </tr>
                </thead>
                <tbody>
                  {ZONES.map((src) =>
                <tr key={src}>
                      <th className="whitespace-nowrap p-1.5 text-left font-medium text-muted">{src}</th>
                      {ZONES.map((dst) => {
                    if (src === dst)
                    return (
                      <td key={dst} className="p-1">
                              <div className="h-7 w-16 rounded bg-hairline/40" />
                            </td>);

                    const cell = segmentation.find((c) => c.source === src && c.destination === dst);
                    const tone = cell?.violation ?
                    'bg-critical/20 text-critical border-critical/40' :
                    cell?.actual === 'ALLOW' ?
                    'bg-accentSoft text-low border-accent/30' :
                    'bg-elevated text-faint border-hairline';
                    return (
                      <td key={dst} className="p-1">
                            <div
                          className={cn(
                            'flex h-7 w-16 items-center justify-center rounded border text-2xs font-semibold',
                            tone
                          )}
                          title={`${src} → ${dst}: intent ${cell?.intended}, actual ${cell?.actual}`}>
                          
                              {cell?.violation ? 'VIOLATION' : cell?.actual}
                            </div>
                          </td>);

                  })}
                    </tr>
                )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              Cells marked VIOLATION cross a zone boundary the intent set forbids. Blank-styled cells are
              blocked by policy.
            </p>
          </Panel>
        </>
      }

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Intent Rule"
        subtitle="Stored in the network_intents table and evaluated on every audit"
        footer={
        <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
            variant="primary"
            onClick={() => {
              addIntent({
                ...draft,
                description:
                draft.description ||
                `${draft.action} ${draft.source} → ${draft.destination} on ${draft.protocol.toUpperCase()}/${draft.port}.`
              });
              setOpen(false);
            }}>
            
              Store Intent
            </Button>
          </>
        }>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source zone">
            <Select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as Zone })}>
              {ZONES.map((z) =>
              <option key={z}>{z}</option>
              )}
            </Select>
          </Field>
          <Field label="Destination zone">
            <Select
              value={draft.destination}
              onChange={(e) => setDraft({ ...draft, destination: e.target.value as Zone })}>
              
              {ZONES.map((z) =>
              <option key={z}>{z}</option>
              )}
            </Select>
          </Field>
          <Field label="Protocol">
            <Select
              value={draft.protocol}
              onChange={(e) => setDraft({ ...draft, protocol: e.target.value as Protocol })}>
              
              {['tcp', 'udp', 'icmp', 'any'].map((p) =>
              <option key={p}>{p}</option>
              )}
            </Select>
          </Field>
          <Field label="Port">
            <Input value={draft.port} onChange={(e) => setDraft({ ...draft, port: e.target.value })} />
          </Field>
          <Field label="Action">
            <Select
              value={draft.action}
              onChange={(e) => setDraft({ ...draft, action: e.target.value as PolicyAction })}>
              
              <option>DENY</option>
              <option>ALLOW</option>
            </Select>
          </Field>
          <Field label="Environment">
            <Select
              value={draft.environment}
              onChange={(e) => setDraft({ ...draft, environment: e.target.value as Environment })}>
              
              {ENVIRONMENTS.map((e) =>
              <option key={e}>{e}</option>
              )}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(e) =>
              setDraft({ ...draft, priority: e.target.value as NetworkIntent['priority'] })
              }>
              
              {PRIORITIES.map((p) =>
              <option key={p}>{p}</option>
              )}
            </Select>
          </Field>
          <Field label="Description">
            <Input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Why this flow is intended or forbidden" />
            
          </Field>
        </div>
      </Modal>
    </>);

}