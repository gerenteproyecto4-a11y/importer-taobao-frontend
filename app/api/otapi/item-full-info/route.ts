import { NextRequest, NextResponse } from 'next/server';
import { fetchAndMapItemFullInfo } from '../category-products/route';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceKey = searchParams.get('instanceKey');
    const itemId = searchParams.get('itemId')?.trim();
    const language = searchParams.get('language') || 'es';

    if (!instanceKey || !itemId) {
      return NextResponse.json(
        { error: 'instanceKey and itemId are required' },
        { status: 400 }
      );
    }

    const item = await fetchAndMapItemFullInfo(itemId, instanceKey, language);
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found or failed to fetch full info' },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
