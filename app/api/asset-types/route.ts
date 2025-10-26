// app/api/asset-types/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/asset-types
 * 
 * Returns all available SiteAssetType enum values from Prisma schema
 * This ensures the frontend always has the complete list of asset types
 */
export async function GET(request: NextRequest) {
  try {
    // Get unique asset types from existing TemplateSiteAssets
    const assetTypes = await prisma.templateSiteAsset.findMany({
      select: {
        type: true,
      },
      distinct: ["type"],
      orderBy: {
        type: "asc",
      },
    });

    // Extract unique types
    const uniqueTypes = assetTypes
      .map((asset) => asset.type)
      .filter((type) => type != null);

    // If no types in database, return the complete enum list from Prisma schema
    if (uniqueTypes.length === 0) {
      // Fallback to known asset types
      return NextResponse.json({
        assetTypes: [
          "social_site",
          "web2_site",
          "other_asset",
          "graphics_design",
          "content_writing",
          "youtube_video_optimization",
          "guest_posting",
          "backlink_analysis",
          "competitor_analysis",
          "keyword_research",
          "local_seo",
          "technical_seo",
          "on_page_seo",
          "off_page_seo",
        ],
        count: 14,
      });
    }

    return NextResponse.json({
      assetTypes: uniqueTypes,
      count: uniqueTypes.length,
    });
  } catch (error) {
    console.error("Error fetching asset types:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch asset types",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
