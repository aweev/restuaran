"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { UserProfileForm } from "@/components/auth/user-profile-form"
import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { ShiftTracker } from "@/components/auth/shift-tracker"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ProfilePage() {
  const { state } = useAuth()
  const router = useRouter()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!state.isAuthenticated && !state.loading) {
      router.push("/login")
    }
  }, [state.isAuthenticated, state.loading, router])

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!state.isAuthenticated) {
    return null // Will redirect to login
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue="profile">
            <TabsList className="mb-4">
              <TabsTrigger value="profile">Profile Information</TabsTrigger>
              <TabsTrigger value="password">Change Password</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <UserProfileForm />
            </TabsContent>

            <TabsContent value="password">
              <ChangePasswordForm />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <ShiftTracker />
        </div>
      </div>
    </div>
  )
}
