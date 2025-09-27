// app/api/social-medias/route.ts
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
// platform is now a free-form string in the DB
const normalizePlatform = (input: unknown): string => {
  const raw = String(input ?? "").trim()
  return raw || "OTHER"
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      clientId?: string
      platform?: string | null
      url?: string | null
      username?: string | null
      email?: string | null
      phone?: string | null
      password?: string | null
      notes?: string | null
    }

    if (!body.clientId) {
      return NextResponse.json({ message: "clientId is required" }, { status: 400 })
    }

  

  } catch (error) {
    console.error("Error creating social media:", error)
    return NextResponse.json({ message: "Failed to create social media" }, { status: 500 })
  }
}

// GET /api/social-medias?clientId=abc
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId") || undefined

 

}
