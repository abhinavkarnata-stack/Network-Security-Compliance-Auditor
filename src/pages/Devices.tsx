import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { PlusIcon, SearchIcon, UploadIcon } from 'lucide-react';
import { AddDeviceModal } from '../components/AddDeviceModal';
import { UploadConfigModal } from '../components/UploadConfigModal';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  Panel,
  Select,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

export function DevicesPage() {
  const { analysis, hasData, loadDemoEnvironment } = useNexus();
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [vendor, setVendor] = useState('all');
  const [environment, setEnvironment] = useState('all');

  const devices = analysis.deviceUpdates;
  const filtered = useMemo(
    () =>
    devices.filter(
      (d) =>
      (vendor === 'all' || d.vendor === vendor) && (
      environment === 'all' || d.environment === environment) && (
      !query ||
      `${d.name} ${d.ip} ${d.type}`.toLowerCase().includes(query.toLowerCase()))
    ),
    [devices, vendor, environment, query]
  );

  return (
    <>
      <PageHeader
        title="Devices"
        description={`${devices.length} total · multi-vendor inventory with live compliance and risk rollups`}
        actions={
        <>
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
              Add Device
            </Button>
            <Button
            variant="primary"
            icon={<UploadIcon className="h-4 w-4" />}
            onClick={() => setUploadOpen(true)}>
            
              Upload Configuration
            </Button>
          </>
        } />
      

      {!hasData ?
      <EmptyState
        title="No devices yet"
        description="Add a device, upload a configuration export, or load the demo environment to populate the inventory."
        actions={
        <Button variant="primary" onClick={loadDemoEnvironment}>
              Load Demo Environment
            </Button>
        } /> :


      <Panel
        bodyClassName="p-0"
        title="Inventory"
        actions={
        <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-faint" />
                <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search devices"
              className="w-44 py-1.5 pl-8 text-xs"
              aria-label="Search devices" />
            
              </div>
              <Select
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-32 py-1.5 text-xs"
            aria-label="Filter by vendor">
            
                <option value="all">All vendors</option>
                {Array.from(new Set(devices.map((d) => d.vendor))).map((v) =>
            <option key={v}>{v}</option>
            )}
              </Select>
              <Select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="w-36 py-1.5 text-xs"
            aria-label="Filter by environment">
            
                <option value="all">All environments</option>
                {Array.from(new Set(devices.map((d) => d.environment))).map((v) =>
            <option key={v}>{v}</option>
            )}
              </Select>
            </div>
        }>
        
          <Table>
            <thead>
              <tr>
                <Th>Device</Th>
                <Th>Vendor</Th>
                <Th>Type</Th>
                <Th>IP</Th>
                <Th>Environment</Th>
                <Th className="text-right">Compliance</Th>
                <Th>Risk</Th>
                <Th>Last scan</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) =>
            <tr key={d.id} className="transition-colors duration-150 ease-out hover:bg-white/[0.03]">
                  <Td>
                    <Link to={`/devices/${d.id}`} className="font-medium text-ink hover:text-accent">
                      {d.name}
                    </Link>
                  </Td>
                  <Td className="text-muted">{d.vendor}</Td>
                  <Td className="text-muted">{d.type}</Td>
                  <Td className="font-mono text-xs text-muted">{d.ip}</Td>
                  <Td className="text-muted">{d.environment}</Td>
                  <Td className="text-right tabular-nums">{d.compliance ? `${d.compliance}%` : '—'}</Td>
                  <Td>
                    <Badge tone={d.risk}>{d.risk}</Badge>
                  </Td>
                  <Td className="text-xs text-muted">
                    {d.lastScan ? `${formatDistanceToNow(new Date(d.lastScan))} ago` : 'never'}
                  </Td>
                  <Td>
                    <span
                  className={
                  d.status === 'Critical' ?
                  'text-critical' :
                  d.status === 'Warning' ?
                  'text-high' :
                  d.status === 'Healthy' ?
                  'text-ok' :
                  'text-muted'
                  }>
                  
                      {d.status}
                    </span>
                  </Td>
                </tr>
            )}
              {!filtered.length &&
            <tr>
                  <Td className="py-6 text-center text-muted">No devices match these filters.</Td>
                </tr>
            }
            </tbody>
          </Table>
        </Panel>
      }

      <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} />
      <UploadConfigModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>);

}