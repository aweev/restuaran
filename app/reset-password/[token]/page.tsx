import { ResetPasswordForm } from "@/components/auth/reset-password-form"

interface ResetPasswordPageProps {
  params: Promise<{
    token: string
  }>
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  // Next 15 delivers dynamic segment params as a Promise.
  const { token } = await params

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Maison Chili POS</h1>
          <p className="mt-2 text-sm text-gray-600">Restaurant Point of Sale System</p>
        </div>

        <ResetPasswordForm token={token} />
      </div>
    </div>
  )
}
