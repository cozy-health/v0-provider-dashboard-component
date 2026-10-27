import { StudentReview } from "@/components/admin/student-review"
import { DevelopmentAccess } from "@/components/admin/development-access"
import { ArticleEditor } from "@/components/admin/article-editor"
import { notFound } from "next/navigation"
import { ManagementPage } from "@/components/admin/management-page"
import { adminModules } from "@/lib/admin-modules"
export default async function Page({ params }: { params: Promise<{ module: string }> }) {
    const { module } = await params
    if (!adminModules.some(([key]) => key === module)) notFound()
    if (module === "student-applications") return <StudentReview />
    if (module === "development-access") return <DevelopmentAccess />
    if (module === "articles") return <ArticleEditor />
    return <ManagementPage key={module} module={module} />
}
