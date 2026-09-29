"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { CustomerHeader } from "@/components/customer/customer-header"
import { CustomerFooter } from "@/components/customer/customer-footer"
import { Star, Loader2 } from "lucide-react"
import type { Order } from "@/types"

export default function FeedbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get("orderId")
  const tableNumber = searchParams.get("table")

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [foodQuality, setFoodQuality] = useState<number | null>(null)
  const [serviceQuality, setServiceQuality] = useState<number | null>(null)
  const [ambience, setAmbience] = useState<number | null>(null)
  const [comments, setComments] = useState("")

  useEffect(() => {
    const fetchOrder = async () => {
      if (orderId) {
        try {
          const response = await fetch(`/api/customer/orders/${orderId}`)

          if (!response.ok) {
            throw new Error("Failed to fetch order")
          }

          const data = await response.json()
          setOrder(data)
        } catch (error) {
          console.error("Error fetching order:", error)
          toast({
            title: "Error",
            description: "Failed to load order details",
            variant: "destructive",
          })
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  const handleSubmit = async () => {
    if (!rating) {
      toast({
        title: "Rating required",
        description: "Please provide an overall rating",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)

    try {
      const feedbackData = {
        orderId: orderId || null,
        tableNumber: tableNumber || null,
        rating,
        foodQuality,
        serviceQuality,
        ambience,
        comments,
        timestamp: new Date().toISOString(),
      }

      const response = await fetch("/api/customer/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(feedbackData),
      })

      if (!response.ok) {
        throw new Error("Failed to submit feedback")
      }

      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted successfully",
      })

      // Redirect to thank you page
      router.push(`/customer/feedback/thank-you${tableNumber ? `?table=${tableNumber}` : ""}`)
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const StarRating = ({ value, onChange }: { value: number | null; onChange: (value: number) => void }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => onChange(star)} className="focus:outline-none">
            <Star
              className={`h-8 w-8 ${value && star <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
            />
          </button>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <CustomerHeader tableNumber={tableNumber} showBackButton title="Feedback" />

        <main className="flex-1 container max-w-lg mx-auto px-4 py-6 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading...</p>
          </div>
        </main>

        <CustomerFooter />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <CustomerHeader tableNumber={tableNumber} showBackButton title="Feedback" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Share Your Feedback</CardTitle>
            <CardDescription>
              {order ? `For your order #${order.id.slice(0, 8)}` : "Help us improve your experience"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              <StarRating value={rating} onChange={setRating} />
            </div>

            <div className="space-y-4">
              <Label>Food Quality</Label>
              <RadioGroup
                value={foodQuality?.toString() || ""}
                onValueChange={(value) => setFoodQuality(Number.parseInt(value))}
                className="flex"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <div key={value} className="flex flex-col items-center space-y-1 flex-1">
                    <RadioGroupItem value={value.toString()} id={`food-${value}`} className="sr-only" />
                    <Label
                      htmlFor={`food-${value}`}
                      className={`cursor-pointer rounded-full p-2 ${
                        foodQuality === value ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {value}
                    </Label>
                    {value === 1 && <span className="text-xs">Poor</span>}
                    {value === 5 && <span className="text-xs">Excellent</span>}
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label>Service Quality</Label>
              <RadioGroup
                value={serviceQuality?.toString() || ""}
                onValueChange={(value) => setServiceQuality(Number.parseInt(value))}
                className="flex"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <div key={value} className="flex flex-col items-center space-y-1 flex-1">
                    <RadioGroupItem value={value.toString()} id={`service-${value}`} className="sr-only" />
                    <Label
                      htmlFor={`service-${value}`}
                      className={`cursor-pointer rounded-full p-2 ${
                        serviceQuality === value ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {value}
                    </Label>
                    {value === 1 && <span className="text-xs">Poor</span>}
                    {value === 5 && <span className="text-xs">Excellent</span>}
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <Label>Ambience</Label>
              <RadioGroup
                value={ambience?.toString() || ""}
                onValueChange={(value) => setAmbience(Number.parseInt(value))}
                className="flex"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <div key={value} className="flex flex-col items-center space-y-1 flex-1">
                    <RadioGroupItem value={value.toString()} id={`ambience-${value}`} className="sr-only" />
                    <Label
                      htmlFor={`ambience-${value}`}
                      className={`cursor-pointer rounded-full p-2 ${
                        ambience === value ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {value}
                    </Label>
                    {value === 1 && <span className="text-xs">Poor</span>}
                    {value === 5 && <span className="text-xs">Excellent</span>}
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Additional Comments</Label>
              <Textarea
                id="comments"
                placeholder="Tell us more about your experience..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="resize-none"
                rows={4}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </CardFooter>
        </Card>
      </main>

      <CustomerFooter />
    </div>
  )
}
