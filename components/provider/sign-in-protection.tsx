'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ShieldCheck, Mail, HelpCircle, RefreshCw } from 'lucide-react'
import { api, ApiError, freshNavigation } from '@/lib/provider-api'
import { AuthCard } from '@/components/auth/auth-card'
import { PasswordInput } from '@/components/auth/password-input'
import { useCooldown } from '@/components/auth/use-cooldown'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type Question = { id: string; prompt: string }
export type ProtectionView = { protection_required: true; stage: 'challenge' | 'enrollment' | 'identity' | 'settings-code' | 'ready'; settings: boolean; expires_at: string; method?: 'email' | 'questions'; questions: Question[]; email_delivery?: string | null; can_save?: boolean; uncertain?: boolean; preferences?: { enabled: boolean; enrolled: boolean; method: 'email' | 'questions'; questions: Question[] } }
export function SignInProtection({ initial, settings = false }: { initial?: ProtectionView; settings?: boolean }) {
  const [view, setView] = useState(initial), [error, setError] = useState(''), [busy, setBusy] = useState(false), [identity, setIdentity] = useState(false), [uncertain, setUncertain] = useState(false)
  const [method, setMethod] = useState<'email' | 'questions'>('questions')
  const [now, setNow] = useState(() => Date.now()), [version, setVersion] = useState(0)
  const alive = useRef(true), command = useRef(false)
  const resend = useCooldown(), limited = useCooldown()
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { const tick = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(tick) }, [])
  useEffect(() => {
    let active = true
    resend.start(60)
    api<ProtectionView>('auth/protection', settings ? { method: 'POST', body: JSON.stringify({ action: 'settings' }) } : {}).then(value => { if (active) { setView(value); if (settings && value.preferences) setMethod(value.preferences.method) } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load protection. Retry.') })
    return () => { active = false }
  }, [settings])
  async function perform(action: string, values: Record<string, unknown> = {}) {
    if (command.current || (limited.remaining > 0 && action !== 'cancel')) return
    command.current = true; setBusy(true); setError('')
    try {
      let result = await api<ProtectionView & { complete?: boolean; cancelled?: boolean }>('auth/protection', { method: 'POST', body: JSON.stringify({ action, ...values }) })
      if (!alive.current) return
      if (result.complete || result.cancelled) { freshNavigation(settings ? '/provider' : result.cancelled ? '/login' : '/provider'); return }
      setView(result); setVersion(value => value + 1)
      if (action === 'verify') { result = await api<ProtectionView>('auth/protection'); if (!alive.current) return; setView(result) }
      if (action === 'resend' || action === 'identity') resend.start(60)
      if (['reconcile', 'verify', 'identity'].includes(action)) setUncertain(false)
    } catch (err) {
      if (!alive.current) return
      const unknownSave = action === 'save' && (!(err instanceof ApiError) || err.status >= 500 || err.status === 409 || err.status === 403)
      if (unknownSave) setUncertain(true)
      if (err instanceof ApiError && err.status === 429) limited.start(err.retryAfter || 60)
      setError(unknownSave ? 'The save response was not confirmed. Check the saved protection before continuing.' : err instanceof Error ? err.message : 'Could not complete the check. Retry.')
    } finally { command.current = false; if (alive.current) setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const values: Record<string, unknown> = {}
    if (action === 'verify') {
      if (view?.method === 'questions') values.answers = Object.fromEntries((view.questions ?? []).map(q => [q.id, String(fields.get(q.id) ?? '')]))
      else values.code = String(fields.get('code') ?? '')
    } else if (action === 'identity') { values.password = String(fields.get('password') ?? ''); setIdentity(false) }
    else if (action === 'save') { values.method = method; if (method === 'questions') values.questions = [0,1,2].map(i => ({ id: String(fields.get(`question-${i}`) ?? ''), answer: String(fields.get(`answer-${i}`) ?? '') })) }
    event.currentTarget.reset()
    void perform(action, values)
  }
  const remaining = Math.max(0, Math.ceil(((view ? Date.parse(view.expires_at) : now) - now) / 1000))
  const locked = busy || limited.remaining > 0
  const check = view && ['challenge', 'settings-code'].includes(view.stage)
  const prefs = view?.preferences
  return <AuthCard compactSpacing audience='Provider portal' title='Sign-in protection' description='Confirm sign-ins on new devices or after 14 days without using a trusted device. Email is available if you forget your secret answers.'>
    {error && <p role='alert' className='mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive'>{error}</p>}
    {limited.remaining > 0 && <p role='status' className='mb-4 text-sm'>Try again in {limited.remaining}s.</p>}
    {!view && <Button className='min-h-11 h-auto whitespace-normal py-2' disabled={busy} onClick={() => freshNavigation(settings ? '/provider/security' : '/login')}>Retry loading</Button>}
    {prefs?.enabled === false ? <p role='status'>Changes to sign-in protection are not available in this development build yet. Your setting has not changed.</p> : <>
      {check && <form key={`${view.stage}-${version}`} onSubmit={event => submit(event, 'verify')} className='space-y-5'>
        <p role='timer' aria-live='off' className='text-sm'>{remaining ? `Check expires in ${Math.floor(remaining / 60)}m ${remaining % 60}s.` : 'This check expired. Start sign-in again.'}</p>
        {view.method === 'email' ? <><p className='text-sm text-muted-foreground'>{view.email_delivery === 'queued' ? 'A code is queued for email delivery. Check your inbox and spam folder.' : view.email_delivery === 'failed' || view.email_delivery === 'unavailable' ? 'The email could not be queued. Retry sending after the cooldown.' : 'Use the latest six-digit code from your email.'}</p><label className='block space-y-2'><span>Six-digit email code</span><Input name='code' inputMode='numeric' pattern='[0-9]{6}' minLength={6} maxLength={6} required autoComplete='one-time-code' disabled={locked} /></label></> : <><p>Answer the two questions you previously chose.</p>{view.questions.map(q => <label className='block space-y-2' key={q.id}><span>{q.prompt}</span><Input name={q.id} type='password' autoComplete='off' spellCheck={false} autoCorrect='off' autoCapitalize='none' required maxLength={200} disabled={locked} /></label>)}</>}
        <Button className='min-h-11 h-auto w-full whitespace-normal py-2' disabled={locked || remaining === 0}><ShieldCheck aria-hidden='true' />Verify and continue</Button>
        <Button type='button' variant='outline' className='min-h-11 h-auto w-full whitespace-normal py-2' disabled={locked || resend.remaining > 0 || remaining === 0} onClick={() => void perform('resend')}><Mail aria-hidden='true' />{resend.remaining ? `Send email code in ${resend.remaining}s` : view.method === 'questions' ? 'Use an email code instead' : 'Resend email code'}</Button>
      </form>}
      {view?.stage === 'identity' && <div className='space-y-4'><p className='text-sm'>Current saved method: {prefs?.method === 'questions' ? 'security questions' : 'email code'}. Enter your current password and a fresh email code before changing it.</p><Button disabled={locked} className='min-h-11 h-auto w-full whitespace-normal py-2' onClick={() => setIdentity(true)}>Confirm identity</Button></div>}
      {view?.stage === 'enrollment' && prefs && <form key={`enrollment-${version}-${method}`} className='space-y-5' onSubmit={event => submit(event, 'save')}>
        <fieldset disabled={locked || uncertain} className='space-y-5'><legend className='mb-3 text-sm'>Choose your sign-in check. Email recovery stays available.</legend><div className='flex flex-wrap gap-3'><Button className='min-h-11 h-auto max-w-full whitespace-normal py-2' type='button' variant={method === 'questions' ? 'default' : 'outline'} aria-pressed={method === 'questions'} onClick={() => setMethod('questions')}><HelpCircle aria-hidden='true' />Security questions</Button><Button className='min-h-11 h-auto max-w-full whitespace-normal py-2' type='button' variant={method === 'email' ? 'default' : 'outline'} aria-pressed={method === 'email'} onClick={() => setMethod('email')}><Mail aria-hidden='true' />Email code</Button></div>
        {method === 'questions' && <><p className='text-sm text-muted-foreground'>Choose three different questions and memorable secret answers that others cannot easily guess.</p>{[0,1,2].map(i => <div className='space-y-3' key={i}><label className='block space-y-2'><span>Question {i + 1}</span><select className='min-h-11 w-full rounded-md border bg-background p-2 text-foreground' required name={`question-${i}`} defaultValue={prefs.questions[i]?.id ?? ''}>{prefs.questions.map(q => <option key={q.id} value={q.id}>{q.prompt}</option>)}</select></label><label className='block space-y-2'><span>Secret answer {i + 1}</span><Input name={`answer-${i}`} type='password' autoComplete='off' spellCheck={false} autoCorrect='off' autoCapitalize='none' minLength={3} maxLength={200} required /></label></div>)}</>}
        <Button className='min-h-11 h-auto w-full whitespace-normal py-2' disabled={!view.can_save}>Save sign-in protection</Button></fieldset>
        {(!view.can_save || uncertain) && <Button className='min-h-11 h-auto whitespace-normal py-2' type='button' variant='outline' disabled={locked} onClick={() => setIdentity(true)}>Confirm identity again</Button>}
      </form>}
      {view?.stage === 'enrollment' && !prefs && <Button className='min-h-11 h-auto whitespace-normal py-2' disabled={locked} onClick={() => void perform('reconcile')}>Retry loading protection</Button>}
      {uncertain && <Button className='mt-4 min-h-11 w-full' variant='outline' disabled={locked} onClick={() => void perform('reconcile')}><RefreshCw aria-hidden='true' />Check saved protection</Button>}
      {view?.stage === 'ready' && <div className='space-y-4'><p>The saved server setting has been checked. Continuing uses that current setting; it does not confirm that an earlier unanswered save succeeded.</p><Button className='min-h-11 h-auto w-full whitespace-normal py-2' disabled={locked} onClick={() => void perform('complete')}>Continue with saved protection</Button><Button className='min-h-11 h-auto w-full whitespace-normal py-2' variant='outline' disabled={locked} onClick={() => setIdentity(true)}>Confirm identity to replace it</Button></div>}
    </>}
    <Button type='button' variant='link' className='mt-5 min-h-11 w-full' disabled={busy} onClick={() => void perform('cancel')}>{settings ? 'Back to settings' : 'Start sign-in again'}</Button>
    <Dialog open={identity} onOpenChange={setIdentity}><DialogContent showCloseButton={false} className='p-[min(24px,4vw)] grid-cols-1 min-w-0 max-h-[calc(100dvh-2rem)] overflow-y-auto [overflow-wrap:anywhere] [&>*]:min-w-0'><DialogHeader><DialogTitle>Confirm your identity</DialogTitle><DialogDescription>Enter your current password. We will send an email code before you can change sign-in protection.</DialogDescription></DialogHeader><form className='space-y-5' onSubmit={event => submit(event, 'identity')}><PasswordInput name='password' label='Current password' autoComplete='current-password' required maxLength={255} /><Button className='min-h-11 h-auto w-full whitespace-normal py-2' disabled={locked}>Send verification code</Button></form><Button type='button' className='min-h-11 h-auto w-full whitespace-normal py-2' variant='outline' onClick={() => setIdentity(false)}>Cancel</Button></DialogContent></Dialog>
  </AuthCard>
}