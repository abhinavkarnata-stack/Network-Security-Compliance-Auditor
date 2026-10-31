import React, { useState } from 'react';
import { RouteIcon } from 'lucide-react';
import { useNexus } from '../store/NexusContext';
import type { Protocol, ReachabilityResult, Zone } from '../types/nexus';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  PathTrail,
  Select } from
'../components/ui/primitives';

const ZONES: Zone[] = ['Internet', 'DMZ', 'Application', 'Database', 'Management', 'Vendor', 'Cloud'];

const PRESETS: {label: string;source: Zone;destination: Zone;protocol: Protocol;port: string;}[] = [
{ label: 'Internet → Production Database (3306)', source: 'Internet', destination: 'Database', protocol: 'tcp', port: '3306' },
{ label: 'Application → Database (3306)', source: 'Application', destination: 'Database', protocol: 'tcp', port: '3306' },
{ label: 'Vendor → Database (3306)', source: 'Vendor', destination: 'Database', protocol: 'tcp', port: '3306' },
{ label: 'Internet → Management (22)', source: 'Internet', destination: 'Management', protocol: 'tcp', port: '22' }];


export function ReachabilityPage() {
  const { checkReachability, hasData } = useNexus();
  const [source, setSource] = useState<Zone>('Internet');
  const [destination, setDestination] = useState<Zone>('Database');
  const [protocol, setProtocol] = useState<Protocol>('tcp');
  const [port, setPort] = useState('3306');
  const [result, setResult] = useState<ReachabilityResult | null>(null);

  const run = (s = source, d = destination, p = protocol, prt = port) => {
    setSource(s);
    setDestination(d);
    setProtocol(p);
    setPort(prt);
    setResult(checkReachability(s, d, p, prt));
  };

  if (!hasData) {
    return (
      <>
        <PageHeader title="Reachability" description="Path analysis across interfaces, routes, zones, NAT and policy." />
        <EmptyState
          title="No network model yet"
          description="Reachability needs at least one parsed configuration. Load the demo environment or upload a configuration." />
        
      </>);

  }

  return (
    <>
      <PageHeader
        title="Reachability"
        description="First-match policy evaluation on every device along every candidate path between two zones." />
      

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Query">
          <div className="space-y-3">
            <Field label="Source">
              <Select value={source} onChange={(e) => setSource(e.target.value as Zone)}>
                {ZONES.map((z) =>
                <option key={z}>{z}</option>
                )}
              </Select>
            </Field>
            <Field label="Destination">
              <Select value={destination} onChange={(e) => setDestination(e.target.value as Zone)}>
                {ZONES.map((z) =>
                <option key={z}>{z}</option>
                )}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Protocol">
                <Select value={protocol} onChange={(e) => setProtocol(e.target.value as Protocol)}>
                  {['tcp', 'udp', 'icmp', 'any'].map((p) =>
                  <option key={p}>{p}</option>
                  )}
                </Select>
              </Field>
              <Field label="Port">
                <Input value={port} onChange={(e) => setPort(e.target.value)} />
              </Field>
            </div>
            <Button variant="primary" className="w-full" icon={<RouteIcon className="h-4 w-4" />} onClick={() => run()}>
              Analyze Reachability
            </Button>

            <div className="pt-2">
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-faint">Common checks</p>
              <div className="space-y-1.5">
                {PRESETS.map((p) =>
                <button
                  key={p.label}
                  onClick={() => run(p.source, p.destination, p.protocol, p.port)}
                  className="block w-full rounded-md border border-hairline bg-elevated px-2.5 py-1.5 text-left text-xs text-muted transition-colors duration-150 ease-out hover:border-accent/40 hover:text-ink">
                  
                    {p.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          {!result ?
          <EmptyState
            title="Run a reachability query"
            description="Pick a source, destination and service, or use one of the common checks to evaluate the current network model." /> :


          <>
              <Panel
              title={`${result.source} → ${result.destination} · ${result.protocol.toUpperCase()}/${result.port}`}
              actions={
              <Badge tone={result.reachable ? 'CRITICAL' : 'PASS'}>
                    {result.reachable ? 'REACHABLE' : 'BLOCKED'}
                  </Badge>
              }>
              
                <p className="text-sm text-muted">
                  {result.reachable ?
                `A ${result.kind} path completes between these zones. Every device on the path is currently permitting the flow.` :
                'No candidate path completes — the flow is denied at the first enforcement point on every path.'}
                </p>
                <p className="mt-2 text-xs text-faint">
                  {result.paths.length} candidate path{result.paths.length === 1 ? '' : 's'} evaluated in
                  the zone topology.
                </p>
              </Panel>

              {result.paths.map((path, i) =>
            <Panel
              key={i}
              title={`Path ${i + 1}`}
              subtitle={path.reachable ? 'Permitted end to end' : `Blocked at ${path.blockedBy?.device}`}
              actions={
              <Badge tone={path.reachable ? 'CRITICAL' : 'PASS'}>
                      {path.reachable ? 'REACHABLE' : 'BLOCKED'}
                    </Badge>
              }>
              
                  <PathTrail hops={path.hops} />
                </Panel>
            )}
            </>
          }
        </div>
      </div>
    </>);

}