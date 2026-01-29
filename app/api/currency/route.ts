import { NextResponse } from 'next/server';
import axios from 'axios';

// Fallback rates (reference rates if API fails)
const FALLBACK_RATES = {
  CNY: 1,
  USD: 0.13867775,
  COP: 528.16,
};

interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
  timestamp: string;
}

// In-memory cache
let cachedRates: CurrencyRates | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Fetch currency rates from exchangerate-api.com
 */
async function fetchCurrencyRates(): Promise<CurrencyRates> {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/CNY', {
      timeout: 5000,
    });

    const rates: CurrencyRates = {
      base: 'CNY',
      rates: {
        CNY: 1,
        USD: response.data.rates.USD || FALLBACK_RATES.USD,
        COP: response.data.rates.COP || FALLBACK_RATES.COP,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Fetched currency rates:', rates);
    return rates;
  } catch (error) {
    console.error('❌ Failed to fetch currency rates, using fallback:', error);
    return {
      base: 'CNY',
      rates: FALLBACK_RATES,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get currency rates with 24-hour cache
 */
export async function getCachedRates(): Promise<CurrencyRates> {
  const now = Date.now();
  
  // Check if cache is still valid
  if (cachedRates && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('✅ Using cached currency rates');
    return cachedRates;
  }

  // Fetch new rates
  console.log('🔄 Fetching fresh currency rates...');
  const rates = await fetchCurrencyRates();
  
  // Update cache
  cachedRates = rates;
  cacheTimestamp = now;
  
  return rates;
}

/**
 * GET /api/currency
 * Returns current currency exchange rates
 */
export async function GET() {
  try {
    const rates = await getCachedRates();
    return NextResponse.json(rates);
  } catch (error) {
    console.error('❌ Error in currency API:', error);
    
    // Return fallback rates even on error
    return NextResponse.json({
      base: 'CNY',
      rates: FALLBACK_RATES,
      timestamp: new Date().toISOString(),
    });
  }
}
