"use client"

import { useId, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = Omit<React.ComponentProps<typeof Input>, "type"> & { label: string; hint?: string }

export function PasswordInput({ label, hint, id, className, onKeyUp, onBlur, ...props }: Props) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  return <div className="space-y-2">
    <label htmlFor={inputId} className="block text-sm font-medium">{label}</label>
    <div className="relative">
      <Input {...props} id={inputId} type={visible ? "text" : "password"} aria-describedby={hint ? `${inputId}-hint` : undefined} className={cn("h-11 pr-12", className)}
        onKeyUp={event => { setCapsLock(event.getModifierState("CapsLock")); onKeyUp?.(event) }} onBlur={event => { setCapsLock(false); onBlur?.(event) }} />
      <button type="button" disabled={props.disabled} aria-controls={inputId} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible}
        onClick={() => setVisible(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
    {hint && <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    {capsLock && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">Caps Lock is on.</p>}
  </div>
}
