import "@/components/admin/admin-theme.css"
export const metadata = { title: "Cozy Health Admin Dashboard", description: "Cozy content management and aggregate wellness analytics" }
export default function Layout({ children }: { children: React.ReactNode }) { return <div className="cozy-admin min-h-screen">{children}</div> }
