import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { UploadIcon } from 'lucide-react';
import { UploadConfigModal } from '../components/UploadConfigModal';
import { useNexus } from '../store/NexusContext';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Table,
  Td,
  Th } from
'../components/ui/primitives';

export function ConfigurationsPage() {
  const { db, orgId, hasData, loadDemoEnvironment } = useNexus();
  const [uploadOpen, setUploadOpen] = useState(false);
  const configs = db.configurations.
  filter((c) => c.orgId === orgId).
  sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return (
    <>
      <PageHeader
        title="Configurations"
        description="Every parsed configuration export, normalized into the vendor-neutral security model."
        actions={
        <Button variant="primary" icon={<UploadIcon className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
            Upload Configuration
          </Button>
        } />
      

      {!configs.length ?
      <EmptyState
        title="No configurations stored"
        description="Upload a Cisco, Fortinet, Juniper or Palo Alto export — NEXUS detects the vendor, parses it and normalizes it for the analysis engines."
        actions={
        !hasData ?
        <Button variant="primary" onClick={loadDemoEnvironment}>
                Load Demo Environment
              </Button> :

        <Button variant="primary" onClick={() => setUploadOpen(true)}>
                Upload Configuration
              </Button>

        } /> :


      <Panel bodyClassName="p-0" title={`${configs.length} configurations`}>
          <Table>
            <thead>
              <tr>
                <Th>Device</Th>
                <Th>Vendor</Th>
                <Th>Version</Th>
                <Th>File</Th>
                <Th>Environment</Th>
                <Th className="text-right">Interfaces</Th>
                <Th className="text-right">Policy rules</Th>
                <Th className="text-right">Secrets</Th>
                <Th>Uploaded</Th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) =>
            <tr key={c.id} className="transition-colors duration-150 ease-out hover:bg-white/[0.03]">
                  <Td>
                    <Link to={`/configurations/${c.id}`} className="font-medium text-ink hover:text-accent">
                      {c.deviceName}
                    </Link>
                  </Td>
                  <Td className="text-muted">{c.vendor}</Td>
                  <Td className="tabular-nums text-muted">v{c.version}</Td>
                  <Td className="font-mono text-xs text-muted">{c.fileName}</Td>
                  <Td className="text-muted">{c.environment}</Td>
                  <Td className="text-right tabular-nums">{c.normalized.interfaces.length}</Td>
                  <Td className="text-right tabular-nums">{c.normalized.firewallRules.length}</Td>
                  <Td className="text-right">
                    {c.normalized.secretsRedacted ?
                <Badge tone="MEDIUM">{c.normalized.secretsRedacted} redacted</Badge> :

                <span className="text-muted">none</span>
                }
                  </Td>
                  <Td className="text-xs text-muted">{format(new Date(c.uploadedAt), 'PPp')}</Td>
                </tr>
            )}
            </tbody>
          </Table>
        </Panel>
      }

      <UploadConfigModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>);

}