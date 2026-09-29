"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { CustomerHeader } from "@/components/customer/customer-header"
import { CustomerFooter } from "@/components/customer/customer-footer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Loader2, Gift, Award, CreditCard, Ticket, Coffee, Pizza, Utensils } from "lucide-react"

interface LoyaltyCustomer {
  id: string
  name: string
  email: string
  phone: string
  points: number
  tier: "bronze" | "silver" | "gold" | "platinum"
  joinDate: string
  lastActivity: string
  totalSpent: number
  visitsCount: number
}

interface LoyaltyReward {
  id: string
  name: string
  description: string
  pointsCost: number
  category: "food" | "drink" | "discount" | "experience"
  icon: string
  available: boolean
}

export default function LoyaltyPage() {
  const searchParams = useSearchParams()
  const tableNumber = searchParams.get("table")

  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(null)
  const [rewards, setRewards] = useState<LoyaltyReward[]>([])
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Check if user is already logged in to loyalty program
    const loyaltyId = localStorage.getItem("loyaltyCustomerId")

    if (loyaltyId) {
      fetchCustomerData(loyaltyId)
    } else {
      setLoading(false)
    }

    // Fetch available rewards
    fetchRewards()
  }, [])

  const fetchCustomerData = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customer/loyalty/${customerId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch loyalty customer data")
      }

      const data = await response.json()
      setCustomer(data)
    } catch (error) {
      console.error("Error fetching loyalty customer data:", error)
      toast({
        title: "Error",
        description: "Failed to load loyalty program data",
        variant: "destructive",
      })
      // Clear invalid loyalty ID
      localStorage.removeItem("loyaltyCustomerId")
    } finally {
      setLoading(false)
    }
  }

  const fetchRewards = async () => {
    try {
      const response = await fetch("/api/customer/loyalty/rewards")

      if (!response.ok) {
        throw new Error("Failed to fetch rewards")
      }

      const data = await response.json()
      setRewards(data)
    } catch (error) {
      console.error("Error fetching rewards:", error)
    }
  }

  const handleLogin = async () => {
    if (!email && !phone) {
      toast({
        title: "Input required",
        description: "Please enter your email or phone number",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/customer/loyalty/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to login to loyalty program")
      }

      const data = await response.json()

      if (data.customer) {
        localStorage.setItem("loyaltyCustomerId", data.customer.id)
        setCustomer(data.customer)

        toast({
          title: "Welcome back!",
          description: `You have ${data.customer.points} loyalty points available`,
        })
      } else {
        toast({
          title: "Account not found",
          description: "No loyalty account found with these credentials",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error logging in to loyalty program:", error)
      toast({
        title: "Error",
        description: "Failed to login to loyalty program",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignup = async () => {
    if (!email || !phone) {
      toast({
        title: "Input required",
        description: "Please enter both email and phone number to sign up",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/customer/loyalty/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          phone,
          tableNumber: tableNumber || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to sign up for loyalty program")
      }

      const data = await response.json()

      localStorage.setItem("loyaltyCustomerId", data.customer.id)
      setCustomer(data.customer)

      toast({
        title: "Welcome to our loyalty program!",
        description: "You've earned 100 welcome points",
      })
    } catch (error) {
      console.error("Error signing up for loyalty program:", error)
      toast({
        title: "Error",
        description: "Failed to sign up for loyalty program",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("loyaltyCustomerId")
    setCustomer(null)
    setEmail("")
    setPhone("")

    toast({
      title: "Logged out",
      description: "You've been logged out of the loyalty program",
    })
  }

  const handleRedeemReward = async (rewardId: string) => {
    if (!customer) return

    try {
      const reward = rewards.find((r) => r.id === rewardId)

      if (!reward) {
        throw new Error("Reward not found")
      }

      if (customer.points < reward.pointsCost) {
        toast({
          title: "Insufficient points",
          description: `You need ${reward.pointsCost - customer.points} more points to redeem this reward`,
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/customer/loyalty/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: customer.id,
          rewardId,
          tableNumber: tableNumber || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to redeem reward")
      }

      const data = await response.json()

      // Update customer data with new points balance
      setCustomer({
        ...customer,
        points: data.newPointsBalance,
      })

      toast({
        title: "Reward redeemed!",
        description: `You've redeemed ${reward.name}. Show this to your server.`,
      })
    } catch (error) {
      console.error("Error redeeming reward:", error)
      toast({
        title: "Error",
        description: "Failed to redeem reward",
        variant: "destructive",
      })
    }
  }

  const getIconForReward = (iconName: string) => {
    switch (iconName) {
      case "coffee":
        return <Coffee className="h-5 w-5" />
      case "pizza":
        return <Pizza className="h-5 w-5" />
      case "utensils":
        return <Utensils className="h-5 w-5" />
      case "ticket":
        return <Ticket className="h-5 w-5" />
      case "gift":
        return <Gift className="h-5 w-5" />
      case "credit-card":
        return <CreditCard className="h-5 w-5" />
      default:
        return <Gift className="h-5 w-5" />
    }
  }

  const getTierProgress = () => {
    if (!customer) return 0

    switch (customer.tier) {
      case "bronze":
        return (customer.points / 1000) * 100
      case "silver":
        return (customer.points / 2500) * 100
      case "gold":
        return (customer.points / 5000) * 100
      case "platinum":
        return 100
      default:
        return 0
    }
  }

  const getNextTier = () => {
    if (!customer) return null

    switch (customer.tier) {
      case "bronze":
        return { name: "Silver", points: 1000 }
      case "silver":
        return { name: "Gold", points: 2500 }
      case "gold":
        return { name: "Platinum", points: 5000 }
      case "platinum":
        return null
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <CustomerHeader tableNumber={tableNumber} showBackButton title="Loyalty Program" />

        <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading loyalty program...</p>
          </div>
        </main>

        <CustomerFooter />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <CustomerHeader tableNumber={tableNumber} showBackButton title="Loyalty Program" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="space-y-6">
          {customer ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{customer.name}</CardTitle>
                      <CardDescription>{customer.email}</CardDescription>
                    </div>
                    <Badge className="uppercase">{customer.tier} Member</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold">{customer.points}</p>
                      <p className="text-sm text-muted-foreground">Available Points</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{customer.visitsCount}</p>
                      <p className="text-sm text-muted-foreground">Total Visits</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${customer.totalSpent.toFixed(0)}</p>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                    </div>
                  </div>

                  {getNextTier() && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress to {getNextTier()?.name}</span>
                        <span>
                          {customer.points} / {getNextTier()?.points}
                        </span>
                      </div>
                      <Progress value={getTierProgress()} className="h-2" />
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={handleLogout} className="w-full">
                    Logout
                  </Button>
                </CardFooter>
              </Card>

              <Tabs defaultValue="rewards">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="rewards">Available Rewards</TabsTrigger>
                  <TabsTrigger value="history">Activity History</TabsTrigger>
                </TabsList>
                <TabsContent value="rewards" className="space-y-4 pt-4">
                  {rewards.length > 0 ? (
                    rewards.map((reward) => (
                      <Card key={reward.id}>
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="rounded-full bg-primary/10 p-3 h-12 w-12 flex items-center justify-center">
                              {getIconForReward(reward.icon)}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{reward.name}</h3>
                              <p className="text-sm text-muted-foreground">{reward.description}</p>
                              <div className="flex justify-between items-center mt-2">
                                <Badge variant="outline">{reward.pointsCost} points</Badge>
                                <Button
                                  size="sm"
                                  disabled={customer.points < reward.pointsCost || !reward.available}
                                  onClick={() => handleRedeemReward(reward.id)}
                                >
                                  Redeem
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">No rewards available at the moment</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="history" className="space-y-4 pt-4">
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Order #12345</p>
                              <p className="text-sm text-muted-foreground">May 15, 2023</p>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              +50 points
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Free Dessert Redeemed</p>
                              <p className="text-sm text-muted-foreground">April 28, 2023</p>
                            </div>
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              -200 points
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Order #12288</p>
                              <p className="text-sm text-muted-foreground">April 20, 2023</p>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              +45 points
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Welcome Bonus</p>
                              <p className="text-sm text-muted-foreground">April 10, 2023</p>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              +100 points
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Join Our Loyalty Program</CardTitle>
                <CardDescription>Earn points with every purchase and redeem them for exclusive rewards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <Button variant="outline" onClick={handleLogin} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  <Button onClick={handleSignup} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex-col space-y-4">
                <Separator />
                <div className="space-y-2 w-full">
                  <h3 className="font-medium text-center">Program Benefits</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      <span className="text-sm">Earn points on every purchase</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-primary" />
                      <span className="text-sm">Exclusive rewards and offers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="text-sm">Birthday specials</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-primary" />
                      <span className="text-sm">Special event invitations</span>
                    </div>
                  </div>
                </div>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      <CustomerFooter />
    </div>
  )
}
