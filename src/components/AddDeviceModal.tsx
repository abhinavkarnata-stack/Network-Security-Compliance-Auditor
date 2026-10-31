import React, { useState } from 'react';
import { useNexus } from '../store/NexusContext';
import type { Device, Environment, Vendor } from '../types/nexus';
import { Button, Field, Input, Modal, Select } from './ui/primitives';

const VENDORS: Vendor[] = ['Cisco', 'Fortinet', 'Juniper', 'Palo Alto'];
const TYPES: Device['type'][] = ['Router', 'Firewall', 'Switch', 'Load Balancer'];
const ENVIRONMENTS: Environment[] = ['Production', 'Development', 'DMZ', 'Cloud'];

export function AddDeviceModal({ open, onClose }: {open: boolean;onClose: () => void;}) {
  const { addDevice } = useNexus();
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState<Vendor>('Cisco');
  const [type, setType] = useState<Device['type']>('Router');
  const [ip, setIp] = useState('');
  const [environment, setEnvironment] = useState<Environment>('Production');
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setIp('');
    setError('');
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Device name is required.');
      return;
    }
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip.trim())) {
      setError('Enter a valid IPv4 management address.');
      return;
    }
    const created = addDevice({ name: name.trim(), vendor, type, ip: ip.trim(), environment });
    if (created) {
      reset();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Device"
      subtitle="Register infrastructure before uploading its configuration"
      footer={
      <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add Device
          </Button>
        </>
      }>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Device name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cisco-Core-02" />
        </Field>
        <Field label="Management IP">
          <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.5" />
        </Field>
        <Field label="Vendor">
          <Select value={vendor} onChange={(e) => setVendor(e.target.value as Vendor)}>
            {VENDORS.map((v) =>
            <option key={v}>{v}</option>
            )}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as Device['type'])}>
            {TYPES.map((t) =>
            <option key={t}>{t}</option>
            )}
          </Select>
        </Field>
        <Field label="Environment">
          <Select value={environment} onChange={(e) => setEnvironment(e.target.value as Environment)}>
            {ENVIRONMENTS.map((t) =>
            <option key={t}>{t}</option>
            )}
          </Select>
        </Field>
      </div>
      {error &&
      <p role="alert" className="mt-3 text-xs text-critical">
          {error}
        </p>
      }
    </Modal>);

}