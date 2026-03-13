import { NextRequest, NextResponse } from 'next/server';
import { getProductFullInfo } from '../category-products/route';
import { getCachedRates } from '@/app/api/currency/route';
import { buildProductDetailFromRaw } from '../build-product-detail';

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

    const raw = await getProductFullInfo(itemId, instanceKey, language);
    if (!raw) {
      return NextResponse.json(
        { error: 'Item not found or failed to fetch full info' },
        { status: 404 }
      );
    }

    const currencyData = await getCachedRates();
    const rates = { USD: currencyData.rates.USD, COP: currencyData.rates.COP };
    const response = buildProductDetailFromRaw(raw, rates);

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
