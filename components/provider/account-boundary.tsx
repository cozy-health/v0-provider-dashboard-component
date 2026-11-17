'use client'
import { useSyncExternalStore } from 'react'
import { currentBrowserScope } from '@/lib/provider-auth-scope'
import { freshNavigation } from '@/lib/provider-api'
function subscribe(change: () => void) {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cozy-provider-account') : null
  if (channel) channel.onmessage = change
  window.addEventListener('cozy-provider-account', change)
  window.addEventListener('focus', change)
  window.addEventListener('pageshow', change)
  document.addEventListener('visibilitychange', change)
  const timer = window.setInterval(change, 1000)
  return () => { channel?.close(); window.clearInterval(timer); window.removeEventListener('cozy-provider-account', change); window.removeEventListener('focus', change); window.removeEventListener('pageshow', change); document.removeEventListener('visibilitychange', change) }
}
export function ProviderAccountBoundary({ scope, children }: { scope: string | null; children: React.ReactNode }) {
  const matches = useSyncExternalStore(subscribe, () => scope === currentBrowserScope(), () => false)
  if (!matches) return <main className='p-8'><p role='status'>Checking this account. If you changed accounts, reload before continuing.</p><button className='mt-4 min-h-11 rounded-lg border px-4' onClick={() => freshNavigation('/login')}>Return to sign in</button></main>
  return children
}