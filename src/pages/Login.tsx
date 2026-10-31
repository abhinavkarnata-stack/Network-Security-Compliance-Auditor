import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldIcon } from 'lucide-react';
import { useNexus } from '../store/NexusContext';
import { Button, Field, Input, Select, cn } from '../components/ui/primitives';
import type { Role } from '../types/nexus';

type Mode = 'signin' | 'signup';

const ROLES: Role[] = ['Administrator', 'Security Analyst', 'Auditor'];

export function LoginPage() {
  const { user, login, register, demoLogin } = useNexus();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('Administrator');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/dashboard" replace />;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signin') {
      if (!email || !password) {
        setError('Enter your email and password.');
        return;
      }
      if (login(email, password)) navigate('/dashboard');else
      setError('Those credentials do not match an account.');
      return;
    }

    if (!name.trim() || !email || !password) {
      setError('Name, email and password are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (register({ name, email, password, organizationName, role })) navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <ShieldIcon className="mx-auto h-8 w-8 text-accent" />
          <h1 className="mt-3 text-2xl font-semibold tracking-[0.22em] text-ink">NEXUS</h1>
          <p className="mt-1.5 text-sm text-muted">AI Network Security Compliance Auditor</p>
        </div>

        <div className="mb-4 flex rounded-md border border-hairline bg-surface p-1" role="tablist">
          {
          [
          { id: 'signin' as Mode, label: 'Sign In' },
          { id: 'signup' as Mode, label: 'Create Account' }].

          map((tab) =>
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => switchMode(tab.id)}
            className={cn(
              'flex-1 rounded px-3 py-1.5 text-sm transition-colors duration-150 ease-out',
              mode === tab.id ? 'bg-accentSoft text-ink' : 'text-muted hover:text-ink'
            )}>
            
              {tab.label}
            </button>
          )}
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-card border border-hairline bg-surface p-6"
          noValidate>
          
          {mode === 'signup' &&
          <>
              <Field label="Full name">
                <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Priya Raman" />
              
              </Field>
              <Field label="Organization" hint="Creates a new, empty tenant you administer.">
                <Input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                autoComplete="organization"
                placeholder="Northwind Financial" />
              
              </Field>
            </>
          }

          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com" />
            
          </Field>

          <Field
            label="Password"
            hint={mode === 'signup' ? 'Minimum 8 characters. Stored only as a salted digest.' : undefined}>
            
            <Input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" />
            
          </Field>

          {mode === 'signup' &&
          <>
              <Field label="Confirm password">
                <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••" />
              
              </Field>
              <Field label="Your role" hint="Determines which actions you can perform in the console.">
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) =>
                <option key={r}>{r}</option>
                )}
                </Select>
              </Field>
            </>
          }

          {error &&
          <p role="alert" className="text-xs text-critical">
              {error}
            </p>
          }

          <Button type="submit" variant="primary" className="w-full">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-2xs uppercase tracking-wider text-faint">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() => {
              demoLogin();
              navigate('/dashboard');
            }}>
            
            Demo Login
          </Button>
        </form>

        {mode === 'signin' ?
        <div className="mt-4 rounded-card border border-hairline bg-surface/60 px-4 py-3 text-xs text-muted">
            <p className="font-medium text-ink">Demo accounts</p>
            <p className="mt-1">demo@nexus.io · Administrator</p>
            <p>analyst@nexus.io · Security Analyst</p>
            <p>auditor@nexus.io · Auditor (read-only)</p>
            <p className="mt-1.5 text-faint">
              Password for all demo accounts: <span className="font-mono">nexus-demo</span>. Credentials
              are stored only as salted digests.
            </p>
          </div> :

        <div className="mt-4 rounded-card border border-hairline bg-surface/60 px-4 py-3 text-xs text-muted">
            <p className="font-medium text-ink">What happens next</p>
            <p className="mt-1">
              A new organization is created and isolated from every other tenant. You start on the
              first-run screen, where you can add a device, upload a configuration, or load the demo
              environment into your own organization.
            </p>
          </div>
        }
      </div>
    </div>);

}