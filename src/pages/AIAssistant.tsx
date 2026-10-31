import React, { useRef, useState } from 'react';
import { BotIcon, SendIcon, ShieldIcon } from 'lucide-react';
import { useNexus } from '../store/NexusContext';
import { Badge, Button, Input, PageHeader, Panel, cn } from '../components/ui/primitives';

const SUGGESTIONS = [
'Why is this critical?',
'Which vendors can reach production?',
'What changed since the last audit?',
'Which systems can reach the database?',
'What are my highest-risk dependencies?',
'How should I remediate this finding?'];


interface Message {
  role: 'user' | 'assistant';
  text: string;
  citations?: string[];
}

export function AIAssistantPage() {
  const { askAI, aiModel, analysis, findings } = useNexus();
  const [messages, setMessages] = useState<Message[]>([
  {
    role: 'assistant',
    text: `I analyse the deterministic audit output — I do not decide PASS/FAIL myself. Current posture: score ${analysis.risk.overall}/100, ${
    findings.filter((f) => f.severity === 'CRITICAL').length} critical findings. Ask me about any finding, flow, vendor or change.`

  }]
  );
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const send = (question: string) => {
    if (!question.trim()) return;
    const answer = askAI(question);
    setMessages((prev) => [
    ...prev,
    { role: 'user', text: question },
    { role: 'assistant', text: answer.answer, citations: answer.citations }]
    );
    setInput('');
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
  };

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="An explanation layer over the compliance, intent, reachability, dependency, drift and risk engines."
        actions={<Badge tone="accent">{aiModel}</Badge>} />
      

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel bodyClassName="p-0" title="Conversation">
          <div className="max-h-[540px] space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((m, i) =>
            <div key={i} className={cn('flex gap-3', m.role === 'user' && 'justify-end')}>
                {m.role === 'assistant' &&
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-elevated">
                    <BotIcon className="h-4 w-4 text-accent" />
                  </span>
              }
                <div
                className={cn(
                  'max-w-2xl whitespace-pre-line rounded-card border px-3.5 py-2.5 text-sm',
                  m.role === 'user' ?
                  'border-accent/30 bg-accentSoft text-ink' :
                  'border-hairline bg-elevated text-muted'
                )}>
                
                  {m.text}
                  {m.citations && m.citations.length > 0 &&
                <p className="mt-2 text-2xs text-faint">
                      Sources: {m.citations.slice(0, 5).join(', ')}
                    </p>
                }
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-hairline px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}>
            
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a finding, flow, vendor or change…"
              aria-label="Ask the assistant" />
            
            <Button type="submit" variant="primary" icon={<SendIcon className="h-4 w-4" />}>
              Ask
            </Button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title="Suggested questions">
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) =>
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-md border border-hairline bg-elevated px-2.5 py-1.5 text-left text-xs text-muted transition-colors duration-150 ease-out hover:border-accent/40 hover:text-ink">
                
                  {s}
                </button>
              )}
            </div>
          </Panel>

          <Panel title="Secret protection" actions={<ShieldIcon className="h-4 w-4 text-ok" />}>
            <ol className="space-y-1.5 text-xs text-muted">
              <li>1. Raw configuration</li>
              <li>2. Secret detection (hashes, PSKs, community strings, tokens)</li>
              <li>3. Redaction</li>
              <li>4. Structured security data</li>
              <li>5. AI layer</li>
            </ol>
            <p className="mt-3 text-xs text-faint">
              Passwords, SSH keys, API tokens, SNMP secrets and credentials are never included in an AI
              request, log line, API response or report.
            </p>
          </Panel>

          <Panel title="Grounding data">
            <ul className="space-y-1 text-xs text-muted">
              <li>{findings.length} findings</li>
              <li>{analysis.intentEvaluations.length} intent rules</li>
              <li>{analysis.vendorRisks.length} third-party dependencies</li>
              <li>{analysis.driftEvents.length} drift events</li>
              <li>{analysis.ruleResults.length} rule evaluations</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>);

}