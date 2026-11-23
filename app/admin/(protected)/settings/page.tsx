"use client"

import { AppearanceSettings } from "@/components/workspace/preferences"
import { ShieldCheck, SlidersHorizontal } from "lucide-react"

export default function SettingsPage() {
  return <div className="space-y-7"><header className="admin-page-heading"><div><p className="workspace-kicker">Your workspace</p><h1 className="mt-3">Settings</h1><p className="mt-3 text-sm text-muted-foreground">A workspace that works the way you do.</p></div><SlidersHorizontal className="text-muted-foreground" size={24} /></header>
    <div className="workspace-settings-grid"><section className="workspace-panel workspace-section-body"><AppearanceSettings /></section><aside className="workspace-panel workspace-context-card"><ShieldCheck size={24} className="mb-4 text-primary" /><h2>Your account, your preferences</h2><p>Appearance and layout are saved to your signed-in account. Your permissions and review responsibilities remain in place in every layout.</p><p>Use Workspace guide above to revisit the important parts of your dashboard.</p></aside></div>
  </div>
}
