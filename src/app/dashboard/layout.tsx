// Force all dashboard pages to use dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
