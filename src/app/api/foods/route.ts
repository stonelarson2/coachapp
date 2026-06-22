import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/server-auth";
import { lookupBarcode, searchFoods } from "@/lib/foodSearch";

export const runtime = "nodejs";
export const maxDuration = 30;

// Food-database search + barcode lookup for the food log.
//  - { query }   → text search across USDA FoodData Central + Open Food Facts
//  - { barcode } → product lookup by barcode (Open Food Facts)
// Returns a list of normalized FoodItem (macros per 100 g + common servings).

interface Body {
  query?: string;
  barcode?: string;
}

export async function POST(req: Request) {
  try {
    await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const barcode = (body.barcode || "").replace(/\D/g, "");
  if (barcode) {
    const item = await lookupBarcode(barcode);
    if (item) return NextResponse.json({ items: [item] });
    return NextResponse.json(
      { error: "No product found for that barcode. Try searching by name.", items: [] },
      { status: 404 },
    );
  }

  const query = (body.query || "").trim();
  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const items = await searchFoods(query);
  return NextResponse.json({ items });
}
