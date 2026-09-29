import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get("customerId")

    if (!customerId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 })
    }

    // Get customer's order history
    const customerOrders = await prisma.order.findMany({
      where: {
        customerName: customerId,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // Consider last 10 orders
    })

    // Extract menu item IDs from order history
    interface OrderItem {
      menuItemId: string;
    }

    interface CustomerOrder {
      items: OrderItem[];
    }

    const orderedItemIds: string[] = customerOrders.flatMap((order: CustomerOrder) => 
      order.items.map((item: OrderItem) => item.menuItemId)
    );

    // Count frequency of each menu item
    const itemFrequency: Record<string, number> = {}
    orderedItemIds.forEach((id) => {
      itemFrequency[id] = (itemFrequency[id] || 0) + 1
    })

    // Get categories of frequently ordered items
    const frequentItemIds = Object.entries(itemFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)

    interface MenuItem {
      id: string;
      category: string;
    }

    const frequentItems: MenuItem[] = await prisma.menuItem.findMany({
      where: {
        id: {
          in: frequentItemIds,
        },
      },
    });

    const preferredCategories: string[] = frequentItems.map((item: MenuItem) => item.category);

    // Get recommendations based on preferred categories
    // Exclude items the customer has already ordered
    const recommendations = await prisma.menuItem.findMany({
      where: {
        category: {
          in: preferredCategories,
        },
        id: {
          notIn: orderedItemIds,
        },
        available: true,
      },
      orderBy: {
        popular: "desc",
      },
      take: 5,
    })

    // If we don't have enough recommendations, add some popular items
    if (recommendations.length < 5) {
      interface AdditionalMenuItem {
        id: string;
        available: boolean;
        popular: boolean;
      }

      interface AdditionalMenuItem {
        id: string;
        available: boolean;
        popular: boolean;
      }

      interface AdditionalMenuItem {
        id: string;
        available: boolean;
        popular: boolean;
      }

      interface AdditionalMenuItem {
        id: string;
        available: boolean;
        popular: boolean;
      }

      interface AdditionalMenuItem {
        id: string;
        available: boolean;
        popular: boolean;
      }

      const additionalItems: AdditionalMenuItem[] = await prisma.menuItem.findMany({
        where: {
          id: {
        notIn: [...orderedItemIds, ...recommendations.map((item: { id: string }) => item.id)],
          },
          available: true,
          popular: true,
        },
        take: 5 - recommendations.length,
      })

      recommendations.push(...additionalItems)
    }

    return NextResponse.json(recommendations)
  } catch (error) {
    console.error("Error fetching personalized recommendations:", error)
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 })
  }
}
