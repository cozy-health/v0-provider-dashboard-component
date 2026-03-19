"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Users,
  FileText,
  Settings,
  Plus,
  UserPlus,
  ArrowLeft,
  BookOpen,
  Video,
  Sparkles,
  Activity,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle2,
  Circle,
  Send,
  X,
  Search,
  AlertTriangle,
  Zap,
  Brain,
  Download,
  Calendar,
  BarChart2,
  Shield,
  FileCheck,
  ChevronRight,
} from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"

type RiskLevel = "high" | "moderate" | "stable"
type AppView = "onboarding" | "dashboard"

interface MoodEntry {
  date: string
  mood: number
  triggers: number
}

interface Trigger {
  name: string
  frequency: number
  impact: "high" | "medium" | "low"
}

interface CopingMechanism {
  name: string
  usage: number
  effectiveness: "positive" | "neutral" | "negative"
}

interface Resource {
  id: string
  title: string
  type: "article" | "video" | "meditation" | "exercise"
  duration: string
  description: string
}

interface AssignedResource extends Resource {
  status: "pending" | "in-progress" | "completed"
  assignedDate: string
  notes?: string
}

interface Patient {
  id: string
  name: string
  riskLevel: RiskLevel
  lastCheckIn: string
  email: string
  age: number
  startDate: string
  moodData: MoodEntry[]
  triggers: Trigger[]
  copingMechanisms: CopingMechanism[]
  assignedResources: AssignedResource[]
}

interface OnboardingForm {
  email: string
  firstName: string
  lastName: string
  practiceName: string
  patientCode: string[]
}

const resourceLibrary: Resource[] = [
  { id: "r1", title: "Managing Workplace Stress", type: "article", duration: "8 min read", description: "Learn practical strategies for handling work-related anxiety and pressure." },
  { id: "r2", title: "Deep Breathing Techniques", type: "video", duration: "12 min", description: "Guided video on diaphragmatic breathing for instant calm." },
  { id: "r3", title: "Morning Mindfulness", type: "meditation", duration: "10 min", description: "Start your day with clarity and intention." },
  { id: "r4", title: "Progressive Muscle Relaxation", type: "exercise", duration: "15 min", description: "Physical relaxation technique to release tension." },
  { id: "r5", title: "Understanding Anxiety Triggers", type: "article", duration: "6 min read", description: "Identify and understand your personal anxiety triggers." },
  { id: "r6", title: "Sleep Hygiene Basics", type: "video", duration: "18 min", description: "Improve your sleep quality with evidence-based tips." },
  { id: "r7", title: "Body Scan Meditation", type: "meditation", duration: "20 min", description: "Full body awareness meditation for deep relaxation." },
  { id: "r8", title: "Journaling for Mental Health", type: "exercise", duration: "Daily", description: "Guided journaling prompts for emotional processing." },
]

const mockPatients: Patient[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    riskLevel: "high",
    lastCheckIn: "2 hours ago",
    email: "sarah.j@email.com",
    age: 28,
    startDate: "Jan 15, 2024",
    moodData: [
      { date: "Mon", mood: 72, triggers: 2 },
      { date: "Tue", mood: 65, triggers: 3 },
      { date: "Wed", mood: 58, triggers: 4 },
      { date: "Thu", mood: 45, triggers: 5 },
      { date: "Fri", mood: 38, triggers: 6 },
      { date: "Sat", mood: 42, triggers: 4 },
      { date: "Sun", mood: 35, triggers: 5 },
    ],
    triggers: [
      { name: "Work Deadlines", frequency: 8, impact: "high" },
      { name: "Sleep Issues", frequency: 6, impact: "high" },
      { name: "Family Conflict", frequency: 4, impact: "medium" },
      { name: "Financial Stress", frequency: 3, impact: "medium" },
    ],
    copingMechanisms: [
      { name: "Breathing Exercises", usage: 12, effectiveness: "positive" },
      { name: "Journaling", usage: 8, effectiveness: "positive" },
      { name: "Isolation", usage: 6, effectiveness: "negative" },
      { name: "Exercise", usage: 3, effectiveness: "positive" },
    ],
    assignedResources: [
      { ...resourceLibrary[0], status: "completed", assignedDate: "Mar 10", notes: "Focus on section 3" },
      { ...resourceLibrary[1], status: "in-progress", assignedDate: "Mar 14" },
    ],
  },
  {
    id: "2",
    name: "Michael Chen",
    riskLevel: "moderate",
    lastCheckIn: "1 day ago",
    email: "m.chen@email.com",
    age: 34,
    startDate: "Feb 3, 2024",
    moodData: [
      { date: "Mon", mood: 55, triggers: 2 },
      { date: "Tue", mood: 58, triggers: 2 },
      { date: "Wed", mood: 52, triggers: 3 },
      { date: "Thu", mood: 60, triggers: 1 },
      { date: "Fri", mood: 55, triggers: 2 },
      { date: "Sat", mood: 62, triggers: 1 },
      { date: "Sun", mood: 58, triggers: 2 },
    ],
    triggers: [
      { name: "Social Situations", frequency: 5, impact: "medium" },
      { name: "Work Pressure", frequency: 4, impact: "medium" },
      { name: "Health Concerns", frequency: 2, impact: "low" },
    ],
    copingMechanisms: [
      { name: "Meditation", usage: 10, effectiveness: "positive" },
      { name: "Walking", usage: 7, effectiveness: "positive" },
      { name: "Avoidance", usage: 4, effectiveness: "negative" },
    ],
    assignedResources: [
      { ...resourceLibrary[2], status: "completed", assignedDate: "Mar 8" },
    ],
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    riskLevel: "stable",
    lastCheckIn: "3 hours ago",
    email: "emily.r@email.com",
    age: 31,
    startDate: "Dec 20, 2023",
    moodData: [
      { date: "Mon", mood: 75, triggers: 1 },
      { date: "Tue", mood: 78, triggers: 0 },
      { date: "Wed", mood: 80, triggers: 1 },
      { date: "Thu", mood: 76, triggers: 1 },
      { date: "Fri", mood: 82, triggers: 0 },
      { date: "Sat", mood: 85, triggers: 0 },
      { date: "Sun", mood: 83, triggers: 1 },
    ],
    triggers: [
      { name: "Minor Work Stress", frequency: 2, impact: "low" },
      { name: "Occasional Sleep Issues", frequency: 1, impact: "low" },
    ],
    copingMechanisms: [
      { name: "Daily Meditation", usage: 14, effectiveness: "positive" },
      { name: "Exercise", usage: 10, effectiveness: "positive" },
      { name: "Social Support", usage: 8, effectiveness: "positive" },
    ],
    assignedResources: [],
  },
  {
    id: "4",
    name: "James Wilson",
    riskLevel: "high",
    lastCheckIn: "30 minutes ago",
    email: "j.wilson@email.com",
    age: 42,
    startDate: "Mar 1, 2024",
    moodData: [
      { date: "Mon", mood: 50, triggers: 3 },
      { date: "Tue", mood: 45, triggers: 4 },
      { date: "Wed", mood: 40, triggers: 5 },
      { date: "Thu", mood: 35, triggers: 6 },
      { date: "Fri", mood: 30, triggers: 7 },
      { date: "Sat", mood: 28, triggers: 6 },
      { date: "Sun", mood: 32, triggers: 5 },
    ],
    triggers: [
      { name: "Job Loss", frequency: 7, impact: "high" },
      { name: "Financial Crisis", frequency: 7, impact: "high" },
      { name: "Relationship Strain", frequency: 5, impact: "high" },
      { name: "Insomnia", frequency: 6, impact: "high" },
    ],
    copingMechanisms: [
      { name: "Alcohol", usage: 8, effectiveness: "negative" },
      { name: "Isolation", usage: 6, effectiveness: "negative" },
      { name: "Breathing Exercises", usage: 3, effectiveness: "positive" },
    ],
    assignedResources: [
      { ...resourceLibrary[4], status: "pending", assignedDate: "Mar 18" },
    ],
  },
  {
    id: "5",
    name: "Amanda Foster",
    riskLevel: "stable",
    lastCheckIn: "5 hours ago",
    email: "a.foster@email.com",
    age: 26,
    startDate: "Jan 8, 2024",
    moodData: [
      { date: "Mon", mood: 70, triggers: 1 },
      { date: "Tue", mood: 72, triggers: 1 },
      { date: "Wed", mood: 75, triggers: 0 },
      { date: "Thu", mood: 73, triggers: 1 },
      { date: "Fri", mood: 78, triggers: 0 },
      { date: "Sat", mood: 80, triggers: 0 },
      { date: "Sun", mood: 77, triggers: 1 },
    ],
    triggers: [
      { name: "Academic Pressure", frequency: 2, impact: "low" },
    ],
    copingMechanisms: [
      { name: "Art Therapy", usage: 12, effectiveness: "positive" },
      { name: "Exercise", usage: 8, effectiveness: "positive" },
    ],
    assignedResources: [],
  },
  {
    id: "6",
    name: "David Kim",
    riskLevel: "moderate",
    lastCheckIn: "4 days ago",
    email: "d.kim@email.com",
    age: 38,
    startDate: "Feb 14, 2024",
    moodData: [
      { date: "Mon", mood: 60, triggers: 2 },
      { date: "Tue", mood: 55, triggers: 3 },
      { date: "Wed", mood: 58, triggers: 2 },
      { date: "Thu", mood: 52, triggers: 3 },
      { date: "Fri", mood: 50, triggers: 3 },
      { date: "Sat", mood: 55, triggers: 2 },
      { date: "Sun", mood: 53, triggers: 2 },
    ],
    triggers: [
      { name: "Work-Life Balance", frequency: 5, impact: "medium" },
      { name: "Parenting Stress", frequency: 4, impact: "medium" },
      { name: "Health Anxiety", frequency: 3, impact: "medium" },
    ],
    copingMechanisms: [
      { name: "Gaming", usage: 10, effectiveness: "neutral" },
      { name: "Family Time", usage: 6, effectiveness: "positive" },
      { name: "Procrastination", usage: 5, effectiveness: "negative" },
    ],
    assignedResources: [
      { ...resourceLibrary[5], status: "in-progress", assignedDate: "Mar 12" },
    ],
  },
  {
    id: "7",
    name: "Rachel Thompson",
    riskLevel: "stable",
    lastCheckIn: "1 hour ago",
    email: "r.thompson@email.com",
    age: 29,
    startDate: "Nov 5, 2023",
    moodData: [
      { date: "Mon", mood: 82, triggers: 0 },
      { date: "Tue", mood: 85, triggers: 0 },
      { date: "Wed", mood: 83, triggers: 1 },
      { date: "Thu", mood: 88, triggers: 0 },
      { date: "Fri", mood: 86, triggers: 0 },
      { date: "Sat", mood: 90, triggers: 0 },
      { date: "Sun", mood: 88, triggers: 0 },
    ],
    triggers: [],
    copingMechanisms: [
      { name: "Yoga", usage: 14, effectiveness: "positive" },
      { name: "Meditation", usage: 14, effectiveness: "positive" },
      { name: "Journaling", usage: 10, effectiveness: "positive" },
    ],
    assignedResources: [],
  },
]

const navItems = [
  { icon: Users, label: "Patients" },
  { icon: FileText, label: "Reports" },
  { icon: Settings, label: "Settings" },
]

// Report data
const monthlyMoodData = [
  { month: "Jan", avgMood: 62, sessions: 145 },
  { month: "Feb", avgMood: 65, sessions: 168 },
  { month: "Mar", avgMood: 68, sessions: 189 },
]

const riskDistribution = [
  { name: "High Risk", value: 2, color: "#f25c05" },
  { name: "Moderate", value: 2, color: "#f2cb05" },
  { name: "Stable", value: 3, color: "#00bc4c" },
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

function getImpactColor(impact: "high" | "medium" | "low") {
  switch (impact) {
    case "high":
      return "text-[#f25c05]"
    case "medium":
      return "text-[#f2cb05]"
    case "low":
      return "text-[#00bc4c]"
  }
}

function getEffectivenessIcon(effectiveness: "positive" | "neutral" | "negative") {
  switch (effectiveness) {
    case "positive":
      return <TrendingUp className="w-4 h-4 text-[#00bc4c]" />
    case "neutral":
      return <Activity className="w-4 h-4 text-[#f2cb05]" />
    case "negative":
      return <TrendingDown className="w-4 h-4 text-[#f25c05]" />
  }
}

function getResourceIcon(type: Resource["type"]) {
  switch (type) {
    case "article":
      return <BookOpen className="w-4 h-4" />
    case "video":
      return <Video className="w-4 h-4" />
    case "meditation":
      return <Sparkles className="w-4 h-4" />
    case "exercise":
      return <Activity className="w-4 h-4" />
  }
}

function getStatusIcon(status: AssignedResource["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-[#00bc4c]" />
    case "in-progress":
      return <Clock className="w-4 h-4 text-[#0460d8]" />
    case "pending":
      return <Circle className="w-4 h-4 text-muted-foreground" />
  }
}

export default function ProviderDashboard() {
  const [appView, setAppView] = useState<AppView>("onboarding")
  const [activeNav, setActiveNav] = useState("Patients")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [codeInputs, setCodeInputs] = useState(["", "", "", "", "", ""])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [resourceSearch, setResourceSearch] = useState("")
  const [assignNotes, setAssignNotes] = useState("")
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  
  // Onboarding state
  const [onboardingForm, setOnboardingForm] = useState<OnboardingForm>({
    email: "",
    firstName: "",
    lastName: "",
    practiceName: "",
    patientCode: ["", "", "", "", "", ""],
  })
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consentAgreed, setConsentAgreed] = useState(false)
  const [dataRevocationAgreed, setDataRevocationAgreed] = useState(false)

  const handleCodeChange = (index: number, value: string) => {
    if (value.length <= 1 && /^[0-9]*$/.test(value)) {
      const newInputs = [...codeInputs]
      newInputs[index] = value
      setCodeInputs(newInputs)

      if (value && index < 5) {
        const nextInput = document.getElementById(`code-${index + 1}`)
        nextInput?.focus()
      }
    }
  }

  const handleOnboardingCodeChange = (index: number, value: string) => {
    if (value.length <= 1 && /^[0-9]*$/.test(value)) {
      const newCode = [...onboardingForm.patientCode]
      newCode[index] = value
      setOnboardingForm({ ...onboardingForm, patientCode: newCode })

      if (value && index < 5) {
        const nextInput = document.getElementById(`onboard-code-${index + 1}`)
        nextInput?.focus()
      }
    }
  }

  const handleOnboardingCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !onboardingForm.patientCode[index] && index > 0) {
      const prevInput = document.getElementById(`onboard-code-${index - 1}`)
      prevInput?.focus()
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
      setIsModalOpen(false)
      setCodeInputs(["", "", "", "", "", ""])
    }
  }

  const resetModal = () => {
    setCodeInputs(["", "", "", "", "", ""])
  }

  const filteredResources = resourceLibrary.filter(
    (r) =>
      r.title.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      r.type.toLowerCase().includes(resourceSearch.toLowerCase())
  )

  const handleAssignResource = () => {
    if (selectedResource && selectedPatient) {
      setIsAssignModalOpen(false)
      setSelectedResource(null)
      setAssignNotes("")
      setResourceSearch("")
    }
  }

  const getMoodTrend = (moodData: MoodEntry[]) => {
    if (moodData.length < 2) return 0
    const first = moodData[0].mood
    const last = moodData[moodData.length - 1].mood
    return last - first
  }

  const handleOnboardingSubmit = () => {
    const code = onboardingForm.patientCode.join("")
    if (
      onboardingForm.email &&
      onboardingForm.firstName &&
      onboardingForm.lastName &&
      onboardingForm.practiceName &&
      code.length === 6
    ) {
      setShowConsentModal(true)
    }
  }

  const handleConsentAgree = () => {
    if (consentAgreed && dataRevocationAgreed) {
      setShowConsentModal(false)
      setAppView("dashboard")
    }
  }

  const handleGenerateReport = () => {
    // In a real app, this would generate and download a PDF
    alert("Generating monthly compliance report...")
  }

  // Onboarding Screen
  if (appView === "onboarding") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/images/cozy-logo.png"
                alt="Cozy"
                width={80}
                height={80}
                className="rounded-2xl"
              />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Welcome to Cozy</h1>
            <p className="text-muted-foreground mt-2">Provider Dashboard - Connect Your First Patient</p>
          </div>

          {/* Signup Form */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Email Address</label>
                <Input
                  type="email"
                  placeholder="provider@clinic.com"
                  value={onboardingForm.email}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">First Name</label>
                  <Input
                    placeholder="Rebecca"
                    value={onboardingForm.firstName}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Last Name</label>
                  <Input
                    placeholder="Moore"
                    value={onboardingForm.lastName}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Practice / Hospital Name</label>
                <Input
                  placeholder="Mindful Health Clinic"
                  value={onboardingForm.practiceName}
                  onChange={(e) => setOnboardingForm({ ...onboardingForm, practiceName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Patient Connection Code</label>
                <p className="text-xs text-muted-foreground mb-3">Enter the 6-digit code from your patient's Cozy app</p>
                <div className="flex justify-center gap-2">
                  {onboardingForm.patientCode.map((digit, index) => (
                    <Input
                      key={index}
                      id={`onboard-code-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOnboardingCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleOnboardingCodeKeyDown(index, e)}
                      className="w-11 h-12 text-center text-xl font-semibold"
                    />
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={handleOnboardingSubmit}
              className="w-full bg-[#0460d8] hover:bg-[#0460d8]/90 text-white h-11"
              disabled={
                !onboardingForm.email ||
                !onboardingForm.firstName ||
                !onboardingForm.lastName ||
                !onboardingForm.practiceName ||
                onboardingForm.patientCode.join("").length !== 6
              }
            >
              Connect Patient
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        {/* Consent Modal */}
        <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-[#0460d8]/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#0460d8]" />
                </div>
                <DialogTitle className="text-xl">Data Sharing Consent</DialogTitle>
              </div>
              <DialogDescription>
                Please review and agree to the following data sharing terms before connecting with your patient.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <h4 className="font-semibold text-foreground">What data will be shared:</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00bc4c] mt-0.5 shrink-0" />
                    <span>Daily mood scores and emotional check-ins</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00bc4c] mt-0.5 shrink-0" />
                    <span>Identified triggers and coping mechanisms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00bc4c] mt-0.5 shrink-0" />
                    <span>Risk assessment scores and alerts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00bc4c] mt-0.5 shrink-0" />
                    <span>Resource engagement and progress metrics</span>
                  </li>
                </ul>
              </div>

              <div className="bg-[#f2cb05]/10 rounded-lg p-4 text-sm">
                <h4 className="font-semibold text-foreground mb-2">Important Notice</h4>
                <p className="text-muted-foreground">
                  The patient can revoke data sharing access at any time through their Cozy app. 
                  You will be notified immediately if access is revoked.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={consentAgreed}
                    onCheckedChange={(checked) => setConsentAgreed(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="consent" className="text-sm text-foreground cursor-pointer">
                    I understand the scope of data being shared and agree to use this information solely for the patient's clinical care.
                  </label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="revocation"
                    checked={dataRevocationAgreed}
                    onCheckedChange={(checked) => setDataRevocationAgreed(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="revocation" className="text-sm text-foreground cursor-pointer">
                    I acknowledge that the patient may revoke access at any time, and I will respect their decision.
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConsentModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConsentAgree}
                disabled={!consentAgreed || !dataRevocationAgreed}
                className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                Agree & Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Patient Detail View
  if (selectedPatient) {
    const moodTrend = getMoodTrend(selectedPatient.moodData)
    const avgMood = Math.round(
      selectedPatient.moodData.reduce((sum, d) => sum + d.mood, 0) /
        selectedPatient.moodData.length
    )

    return (
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <Image
                src="/images/cozy-logo.png"
                alt="Cozy"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <h1 className="font-semibold text-lg">Cozy</h1>
                <p className="text-xs text-sidebar-foreground/60">Provider Dashboard</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => {
                      setActiveNav(item.label)
                      if (item.label !== "Patients") setSelectedPatient(null)
                    }}
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

        {/* Main Content - Patient Detail */}
        <main className="flex-1 p-8 overflow-auto">
          {/* Back Button & Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedPatient(null)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#0460d8]/10 flex items-center justify-center text-[#0460d8] font-semibold text-lg">
                  {selectedPatient.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                    {selectedPatient.name}
                    <Badge className={cn("font-medium", getRiskBadgeStyles(selectedPatient.riskLevel))}>
                      {getRiskLabel(selectedPatient.riskLevel)}
                    </Badge>
                  </h2>
                  <p className="text-muted-foreground">
                    {selectedPatient.email} | Age {selectedPatient.age} | Patient since{" "}
                    {selectedPatient.startDate}
                  </p>
                </div>
              </div>
            </div>
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Resource
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Assign Resource</DialogTitle>
                  <DialogDescription>
                    Search and assign therapeutic resources to {selectedPatient.name}.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search resources..."
                      value={resourceSearch}
                      onChange={(e) => setResourceSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="max-h-60 overflow-auto space-y-2">
                    {filteredResources.map((resource) => (
                      <div
                        key={resource.id}
                        onClick={() => setSelectedResource(resource)}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedResource?.id === resource.id
                            ? "border-[#0460d8] bg-[#0460d8]/5"
                            : "border-border hover:border-[#0460d8]/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#0460d8]/10 flex items-center justify-center text-[#0460d8]">
                            {getResourceIcon(resource.type)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{resource.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)} |{" "}
                              {resource.duration}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedResource && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Add notes (optional)</p>
                      <Textarea
                        placeholder="Any specific instructions or notes for the patient..."
                        value={assignNotes}
                        onChange={(e) => setAssignNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignResource}
                    disabled={!selectedResource}
                    className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Assign to Patient
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0460d8]/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-[#0460d8]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{avgMood}</p>
                  <p className="text-sm text-muted-foreground">Avg Mood</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    moodTrend >= 0 ? "bg-[#00bc4c]/10" : "bg-[#f25c05]/10"
                  )}
                >
                  {moodTrend >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-[#00bc4c]" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-[#f25c05]" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-semibold">
                    {moodTrend >= 0 ? "+" : ""}
                    {moodTrend}%
                  </p>
                  <p className="text-sm text-muted-foreground">Weekly Trend</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f25c05]/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#f25c05]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{selectedPatient.triggers.length}</p>
                  <p className="text-sm text-muted-foreground">Active Triggers</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00bc4c]/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-[#00bc4c]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">
                    {selectedPatient.copingMechanisms.filter((c) => c.effectiveness === "positive").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Positive Coping</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="triggers">Triggers</TabsTrigger>
              <TabsTrigger value="coping">Coping Mechanisms</TabsTrigger>
              <TabsTrigger value="resources">Assigned Resources</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Mood Timeline */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Mood Timeline</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedPatient.moodData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="mood"
                        stroke="#0460d8"
                        strokeWidth={2}
                        dot={{ fill: "#0460d8", strokeWidth: 2 }}
                        name="Mood Score"
                      />
                      <Line
                        type="monotone"
                        dataKey="triggers"
                        stroke="#f25c05"
                        strokeWidth={2}
                        dot={{ fill: "#f25c05", strokeWidth: 2 }}
                        name="Trigger Events"
                        yAxisId={0}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Top Triggers */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#f25c05]" />
                    Top Triggers
                  </h3>
                  <div className="space-y-3">
                    {selectedPatient.triggers.slice(0, 4).map((trigger, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="font-medium">{trigger.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", getImpactColor(trigger.impact))}>
                            {trigger.impact.toUpperCase()}
                          </span>
                          <span className="text-sm text-muted-foreground">({trigger.frequency}x)</span>
                        </div>
                      </div>
                    ))}
                    {selectedPatient.triggers.length === 0 && (
                      <p className="text-muted-foreground text-sm">No triggers recorded</p>
                    )}
                  </div>
                </div>

                {/* Top Coping */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-[#00bc4c]" />
                    Coping Mechanisms
                  </h3>
                  <div className="space-y-3">
                    {selectedPatient.copingMechanisms.slice(0, 4).map((coping, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="font-medium">{coping.name}</span>
                        <div className="flex items-center gap-2">
                          {getEffectivenessIcon(coping.effectiveness)}
                          <span className="text-sm text-muted-foreground">{coping.usage} uses</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Triggers Tab */}
            <TabsContent value="triggers">
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Trigger Analysis</h3>
                <div className="h-72 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedPatient.triggers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="frequency" fill="#f25c05" radius={[4, 4, 0, 0]} name="Frequency" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Impact Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPatient.triggers.map((trigger, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{trigger.name}</TableCell>
                        <TableCell>{trigger.frequency} occurrences</TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              trigger.impact === "high" && "bg-[#f25c05] text-white",
                              trigger.impact === "medium" && "bg-[#f2cb05] text-[#1a1a1a]",
                              trigger.impact === "low" && "bg-[#00bc4c] text-white"
                            )}
                          >
                            {trigger.impact.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedPatient.triggers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No triggers have been recorded for this patient.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Coping Tab */}
            <TabsContent value="coping">
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Coping Mechanism Analysis</h3>
                <div className="h-72 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedPatient.copingMechanisms}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="usage"
                        fill="#0460d8"
                        radius={[4, 4, 0, 0]}
                        name="Usage Count"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coping Mechanism</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Effectiveness</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPatient.copingMechanisms.map((coping, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{coping.name}</TableCell>
                        <TableCell>{coping.usage} times</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getEffectivenessIcon(coping.effectiveness)}
                            <span
                              className={cn(
                                coping.effectiveness === "positive" && "text-[#00bc4c]",
                                coping.effectiveness === "neutral" && "text-[#f2cb05]",
                                coping.effectiveness === "negative" && "text-[#f25c05]"
                              )}
                            >
                              {coping.effectiveness.charAt(0).toUpperCase() + coping.effectiveness.slice(1)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Assigned Resources</h3>
                  <Button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Assign New
                  </Button>
                </div>
                {selectedPatient.assignedResources.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPatient.assignedResources.map((resource, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#0460d8]/10 flex items-center justify-center text-[#0460d8]">
                          {getResourceIcon(resource.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{resource.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)} |{" "}
                            {resource.duration} | Assigned {resource.assignedDate}
                          </p>
                          {resource.notes && (
                            <p className="text-sm text-[#0460d8] mt-1">Note: {resource.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(resource.status)}
                          <span
                            className={cn(
                              "text-sm font-medium",
                              resource.status === "completed" && "text-[#00bc4c]",
                              resource.status === "in-progress" && "text-[#0460d8]",
                              resource.status === "pending" && "text-muted-foreground"
                            )}
                          >
                            {resource.status === "in-progress"
                              ? "In Progress"
                              : resource.status.charAt(0).toUpperCase() + resource.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      No resources assigned to this patient yet.
                    </p>
                    <Button
                      onClick={() => setIsAssignModalOpen(true)}
                      className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Assign First Resource
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    )
  }

  // Reports View
  if (activeNav === "Reports") {
    return (
      <div className="flex min-h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <Image
                src="/images/cozy-logo.png"
                alt="Cozy"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <h1 className="font-semibold text-lg">Cozy</h1>
                <p className="text-xs text-sidebar-foreground/60">Provider Dashboard</p>
              </div>
            </div>
          </div>

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

        {/* Main Content - Reports */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Audit-Ready Reports</h2>
              <p className="text-muted-foreground mt-1">Generate compliance reports for institutional partners</p>
            </div>
            <Button onClick={handleGenerateReport} className="bg-[#0460d8] hover:bg-[#0460d8]/90 text-white">
              <Download className="w-4 h-4 mr-2" />
              Generate Monthly Report
            </Button>
          </div>

          {/* Report Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0460d8]/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#0460d8]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">502</p>
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00bc4c]/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#00bc4c]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">65</p>
                  <p className="text-sm text-muted-foreground">Avg Mood Score</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f2cb05]/10 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-[#f2cb05]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">24</p>
                  <p className="text-sm text-muted-foreground">Assessments</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f25c05]/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#f25c05]" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">8</p>
                  <p className="text-sm text-muted-foreground">Risk Alerts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Mood Trend Chart */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Monthly Mood Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyMoodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgMood"
                      stroke="#0460d8"
                      strokeWidth={3}
                      dot={{ fill: "#0460d8", strokeWidth: 2, r: 6 }}
                      name="Average Mood"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Patient Risk Distribution</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly Report Generator */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#0460d8]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#0460d8]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Monthly Report Generator</h3>
                <p className="text-sm text-muted-foreground">One-click PDF generation for compliance</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Report Contents</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-[#00bc4c]" />
                    <span className="text-sm">Total sessions logged</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-[#00bc4c]" />
                    <span className="text-sm">Mood trend analytics</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-[#00bc4c]" />
                    <span className="text-sm">Assessment scores</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-[#00bc4c]" />
                    <span className="text-sm">Risk history timeline</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-[#00bc4c]" />
                    <span className="text-sm">Engagement metrics</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Previous Reports</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">February 2024 Report</p>
                        <p className="text-xs text-muted-foreground">Generated Mar 1, 2024</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">January 2024 Report</p>
                        <p className="text-xs text-muted-foreground">Generated Feb 1, 2024</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">December 2023 Report</p>
                        <p className="text-xs text-muted-foreground">Generated Jan 1, 2024</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Main Patient List View
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <Image
              src="/images/cozy-logo.png"
              alt="Cozy"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <div>
              <h1 className="font-semibold text-lg">Cozy</h1>
              <p className="text-xs text-sidebar-foreground/60">Provider Dashboard</p>
            </div>
          </div>
        </div>

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Patients</h2>
            <p className="text-muted-foreground mt-1">Monitor and manage your patient roster</p>
          </div>

          <Dialog
            open={isModalOpen}
            onOpenChange={(open) => {
              setIsModalOpen(open)
              if (!open) resetModal()
            }}
          >
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
                  {mockPatients.filter((p) => p.riskLevel === "high").length}
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
                  {mockPatients.filter((p) => p.riskLevel === "moderate").length}
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
                  {mockPatients.filter((p) => p.riskLevel === "stable").length}
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
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0460d8]/10 flex items-center justify-center text-[#0460d8] font-medium text-sm">
                          {patient.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <span className="font-medium">{patient.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("font-medium", getRiskBadgeStyles(patient.riskLevel))}>
                        {getRiskLabel(patient.riskLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{patient.lastCheckIn}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}
