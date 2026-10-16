import { Activity, BellRing, BookOpen, Brain, ChartNoAxesCombined, ClipboardCheck, ClipboardList, CreditCard, Database, Flag, HandHeart, Heart, History, LayoutDashboard, LifeBuoy, Mail, MessageCircle, MessagesSquare, Package, ShieldCheck, Smile, Smartphone, Sparkles, Target, TrendingUp, UserRound, UserRoundCheck, UserRoundPlus, UsersRound, type LucideIcon } from "lucide-react"

type Visual = { icon: LucideIcon; tone: "blue" | "green" | "orange" | "yellow" }
export const moduleVisuals: Record<string, Visual> = {
 dashboard: { icon: LayoutDashboard, tone: "blue" }, datacenter: { icon: Database, tone: "green" },
 users: { icon: UsersRound, tone: "blue" }, moods: { icon: Smile, tone: "yellow" }, expressions: { icon: Heart, tone: "orange" },
 triggers: { icon: BellRing, tone: "orange" }, "user-triggers": { icon: Activity, tone: "orange" }, coping: { icon: HandHeart, tone: "green" }, "user-coping": { icon: LifeBuoy, tone: "green" },
 communities: { icon: MessagesSquare, tone: "blue" }, reports: { icon: Flag, tone: "orange" }, support: { icon: LifeBuoy, tone: "green" }, challenges: { icon: Target, tone: "orange" }, quizzes: { icon: ClipboardList, tone: "blue" },
 packages: { icon: Package, tone: "yellow" }, subscriptions: { icon: CreditCard, tone: "green" }, emails: { icon: Mail, tone: "blue" }, posts: { icon: BookOpen, tone: "blue" }, comments: { icon: MessageCircle, tone: "green" }, members: { icon: UserRoundCheck, tone: "yellow" }, "subscription-events": { icon: History, tone: "orange" },
 overview: { icon: ChartNoAxesCombined, tone: "blue" }, usage: { icon: Smartphone, tone: "green" }, retention: { icon: UserRound, tone: "yellow" }, safety: { icon: ShieldCheck, tone: "orange" },
}
const panelVisuals: Record<string, Visual> = {
 "New Users": { icon: UserRoundPlus, tone: "blue" }, "Active Users": { icon: UserRoundCheck, tone: "green" }, "Community Posts": moduleVisuals.posts, "Pending Reports": moduleVisuals.reports,
 "Mood Check-ins": moduleVisuals.moods, "Quiz Completions": { icon: ClipboardCheck, tone: "green" }, "Top Mood": moduleVisuals.moods, "Top Trigger": moduleVisuals.triggers, "Top Coping Mechanism": moduleVisuals.coping,
 "Average reported intensity": { icon: Brain, tone: "orange" }, "User growth · daily registrations": { icon: TrendingUp, tone: "blue" }, "Daily active record creators": { icon: Activity, tone: "green" },
 "Mood distribution": moduleVisuals.moods, "Top triggers": moduleVisuals.triggers, "Top coping mechanisms": moduleVisuals.coping, "Feature usage": moduleVisuals.usage,
 "Mood trends": { icon: TrendingUp, tone: "blue" }, "Registered device distribution": moduleVisuals.usage, "Signup cohort retention": moduleVisuals.retention,
 "Reported coping helpfulness": moduleVisuals.coping, "Anxiety check-ins by UTC hour": { icon: Activity, tone: "orange" }, "Challenge participation": moduleVisuals.challenges, "Challenge task completions": { icon: ClipboardCheck, tone: "green" },
 "Subscription status changes": moduleVisuals["subscription-events"], "Weekly Sales": moduleVisuals.subscriptions, "Emergency Calls": moduleVisuals.support, "Completed Mindfulness Sessions": moduleVisuals.coping, "Reports": moduleVisuals.reports,
}
export function panelVisual(title: string): Visual { return panelVisuals[title] ?? { icon: Sparkles, tone: "blue" } }
export function AdminIcon({ visual, small = false }: { visual: Visual; small?: boolean }) {
 const Icon = visual.icon
 if (!small) return null
 return <span aria-hidden="true" className={`admin-icon admin-tone-${visual.tone} ${small ? "admin-icon-small" : ""}`}><Icon className={small ? "size-4" : "size-5"} strokeWidth={1.8} /></span>
}
export const moduleDescriptions: Record<string, string> = {
 users: "View account details for the people who make Cozy a community. User accounts are read-only.", moods: "Make room for every feeling with thoughtful mood options.", expressions: "Help people put their feelings into words.", triggers: "Organize the moments and experiences that shape feelings.", coping: "Build a collection of supportive ways to feel better.",
 communities: "Create welcoming spaces for connection and support.", challenges: "Encourage small steps toward everyday wellbeing.", quizzes: "Create and review quizzes that support self-reflection.", packages: "Keep your wellness packages clear and up to date.", subscriptions: "Review recorded subscriptions and their status.", emails: "Review transactional emails and check delivery activity.", reports: "Review community concerns with care.", support: "Help people get the support they need.", posts: "Care for the conversations happening across Cozy.", comments: "Review replies and keep conversations welcoming.", members: "Review the people connected to each community.", "subscription-events": "Follow the recorded changes to subscriptions.",
}
