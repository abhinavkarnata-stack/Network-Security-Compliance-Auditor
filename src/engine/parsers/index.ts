import type { NormalizedConfig, Vendor } from '../../types/nexus';
import { parseCisco } from './cisco';
import { parseFortinet } from './fortinet';
import { parseJuniper } from './juniper';
import { parsePaloAlto } from './paloalto';

export interface VendorDetection {
  vendor: Vendor | null;
  confidence: number;
  signals: string[];
}

/**
 * Vendor detection by configuration syntax fingerprinting. New vendors are added
 * by registering a signature + parser below — the rest of the pipeline is
 * vendor agnostic because everything downstream consumes NormalizedConfig.
 */
const SIGNATURES: {vendor: Vendor;patterns: RegExp[];}[] = [
{
  vendor: 'Fortinet',
  patterns: [/^config system global/m, /config firewall policy/, /set srcintf/, /^next$/m]
},
{
  vendor: 'Palo Alto',
  patterns: [/set deviceconfig system/, /rulebase security rules/, /set mgt-config/]
},
{
  vendor: 'Juniper',
  patterns: [/set system host-name/, /security zones security-zone/, /set interfaces ge-/]
},
{
  vendor: 'Cisco',
  patterns: [/^hostname\s/m, /ip access-list extended/, /^interface GigabitEthernet/m, /^line vty/m]
}];


export function detectVendor(raw: string): VendorDetection {
  let best: VendorDetection = { vendor: null, confidence: 0, signals: [] };
  for (const sig of SIGNATURES) {
    const signals = sig.patterns.filter((p) => p.test(raw)).map((p) => p.source);
    const confidence = signals.length / sig.patterns.length;
    if (confidence > best.confidence) {
      best = { vendor: sig.vendor, confidence, signals };
    }
  }
  return best.confidence >= 0.5 ? best : { vendor: null, confidence: best.confidence, signals: [] };
}

export const PARSERS: Record<Vendor, (raw: string, name?: string) => NormalizedConfig> = {
  Cisco: parseCisco,
  Fortinet: parseFortinet,
  Juniper: parseJuniper,
  'Palo Alto': parsePaloAlto
};

export function parseConfiguration(
raw: string,
vendor: Vendor,
fallbackName?: string)
: NormalizedConfig {
  const parser = PARSERS[vendor];
  if (!parser) throw new Error(`No parser registered for vendor ${vendor}`);
  return parser(raw, fallbackName);
}

export { parseCisco, parseFortinet, parseJuniper, parsePaloAlto };