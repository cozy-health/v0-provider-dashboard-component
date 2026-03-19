"use client"

import { useState } from "react"
import { Users, BarChart3, Settings, Plus, UserPlus, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type RiskLevel = "high" | "moderate" | "stable"

interface Patient {
  id: string
  name: string
  riskLevel: RiskLevel
  lastCheckIn: string
}

const mockPatients: Patient[] = [
  { id: "1", name: "Sarah Johnson", riskLevel: "high", lastCheckIn: "2 hours ago" },
  { id: "2", name: "Michael Chen", riskLevel: "moderate", lastCheckIn: "1 day ago" },
  { id: "3", name: "Emily Rodriguez", riskLevel: "stable", lastCheckIn: "3 hours ago" },
  { id: "4", name: "James Wilson", riskLevel: "high", lastCheckIn: "30 minutes ago" },
  { id: "5", name: "Amanda Foster", riskLevel: "stable", lastCheckIn: "5 hours ago" },
  { id: "6", name: "David Kim", riskLevel: "moderate", lastCheckIn: "4 days ago" },
  { id: "7", name: "Rachel Thompson", riskLevel: "stable", lastCheckIn: "1 hour ago" },
]

const navItems = [
  { icon: Users, label: "Patients", active: true },
  { icon: BarChart3, label: "Analytics", active: false },
  { icon: Settings, label: "Settings", active: false },
]

function getRiskBadgeStyles(risk: RiskLevel) {
  switch (risk) {
    case "high":
      return "bg-[#f25c05] text-white hover:bg-[#f25c05]/90"
    case "moderate":
      return "bg-[#f2cb05] text-[#1a1a1a] hover:bg-[#f2cb05]/90"
    case "stable":
      return "bg-[#00bc4c] text-white hover:bg-[#00bc4c]/90"
  }
}

function getRiskLabel(risk: RiskLevel) {
  switch (risk) {
    case "high":
      return "High Risk"
    case "moderate":
      return "Moderate"
    case "stable":
      return "Stable"
  }
}

export default function ProviderDashboard() {
  const [activeNav, setActiveNav] = useState("Patients")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [patientCode, setPatientCode] = useState("")
  const [codeInputs, setCodeInputs] = useState(["", "", "", "", "", ""])

  const handleCodeChange = (index: number, value: string) => {
    if (value.length <= 1 && /^[0-9]*$/.test(value)) {
      const newInputs = [...codeInputs]
      newInputs[index] = value
      setCodeInputs(newInputs)
      setPatientCode(newInputs.join(""))
      
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`code-${index + 1}`)
        nextInput?.focus()
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !codeInputs[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleConnect = () => {
    const code = codeInputs.join("")
    if (code.length === 6) {
      // Handle connection logic here
      console.log("Connecting patient with code:", code)
      setIsModalOpen(false)
      setCodeInputs(["", "", "", "", "", ""])
    }
  }

  const resetModal = () => {
    setCodeInputs(["", "", "", "", "", ""])
    setPatientCode("")
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0460d8] flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Cozy</h1>
              <p className="text-xs text-sidebar-foreground/60">Provider Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.label}>
                <button
                  onClick={() => setActiveNav(item.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                    activeNav === item.label
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-9 h-9 rounded-full bg-[#0460d8] flex items-center justify-center text-white font-medium text-sm">
              DR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Dr. Rebecca Moore</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">Clinical Therapist</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Patients</h2>
            <p className="text-muted-foreground mt-1">Monitor and manage your patient roster</p>
          </div>
          
          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open)
            if (!open) resetModal()
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                Connect New Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Connect New Patient</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit code provided by your patient to establish a secure connection.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6">
                <div className="flex justify-center gap-2">
                  {codeInputs.map((digit, index) => (
                    <Input
                      key={index}
                      id={`code-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-14 text-center text-2xl font-semibold"
                    />
                  ))}
                </div>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Ask your patient for their unique connection code from the Cozy app.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleConnect}
                  disabled={codeInputs.join("").length !== 6}
                  className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Connect Patient
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f25c05]/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#f25c05]" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {mockPatients.filter(p => p.riskLevel === "high").length}
                </p>
                <p className="text-sm text-muted-foreground">High Risk</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f2cb05]/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#f2cb05]" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {mockPatients.filter(p => p.riskLevel === "moderate").length}
                </p>
                <p className="text-sm text-muted-foreground">Moderate</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00bc4c]/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#00bc4c]" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {mockPatients.filter(p => p.riskLevel === "stable").length}
                </p>
                <p className="text-sm text-muted-foreground">Stable</p>
              </div>
            </div>
          </div>
        </div>

        {/* Patient Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Patient Name</TableHead>
                <TableHead className="font-semibold">Risk Level</TableHead>
                <TableHead className="font-semibold">Last Check-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPatients
                .sort((a, b) => {
                  const order = { high: 0, moderate: 1, stable: 2 }
                  return order[a.riskLevel] - order[b.riskLevel]
                })
                .map((patient) => (
                  <TableRow key={patient.id} className="cursor-pointer hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0460d8]/10 flex items-center justify-center text-[#0460d8] font-medium text-sm">
                          {patient.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <span className="font-medium">{patient.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("font-medium", getRiskBadgeStyles(patient.riskLevel))}>
                        {getRiskLabel(patient.riskLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.lastCheckIn}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}
