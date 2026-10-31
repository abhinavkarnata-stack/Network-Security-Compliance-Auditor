/**
 * Secret detection + redaction. Everything that leaves the analysis layer for
 * the AI layer, reports, or logs passes through here first.
 */

const SECRET_RULES: {label: string;pattern: RegExp;replace: string;}[] = [
{ label: 'IOS secret hash', pattern: /(secret\s+\d?\s*)(\S+)/gi, replace: '$1[REDACTED]' },
{ label: 'Encrypted password', pattern: /(password\s+ENC\s+)(\S+)/gi, replace: '$1[REDACTED]' },
{ label: 'Pre-shared key', pattern: /(psksecret\s+ENC\s+|pre-shared-key\s+)(\S+)/gi, replace: '$1[REDACTED]' },
{ label: 'JunOS password hash', pattern: /(encrypted-password\s+)("?\S+"?)/gi, replace: '$1[REDACTED]' },
{ label: 'PAN-OS password hash', pattern: /(phash\s+)(\S+)/gi, replace: '$1[REDACTED]' },
{ label: 'SNMP community', pattern: /(community\s+)("?[\w-]+"?)/gi, replace: '$1[REDACTED]' },
{ label: 'API token', pattern: /((?:api[-_]?key|token)\s*[:=]\s*)(\S+)/gi, replace: '$1[REDACTED]' },
{ label: 'Private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replace: '[REDACTED PRIVATE KEY]' }];


export interface RedactionResult {
  text: string;
  redactedCount: number;
  categories: string[];
}

export function redactSecrets(raw: string): RedactionResult {
  let text = raw;
  let redactedCount = 0;
  const categories: string[] = [];
  for (const rule of SECRET_RULES) {
    const matches = text.match(rule.pattern);
    if (matches && matches.length) {
      redactedCount += matches.length;
      categories.push(rule.label);
      text = text.replace(rule.pattern, rule.replace);
    }
  }
  return { text, redactedCount, categories: Array.from(new Set(categories)) };
}

/** Deep-strips secret-looking values from any structured payload sent to the AI layer. */
const SENSITIVE_KEYS = /(password|secret|psk|token|key|community|credential|hash)/i;

export function sanitizeForAI<T>(payload: T): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
        out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : walk(v);
      });
      return out;
    }
    if (typeof value === 'string') return redactSecrets(value).text;
    return value;
  };
  return walk(payload) as T;
}