import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getCachedRates } from '@/app/api/currency/route';

interface FeaturedValue {
  Name: string;
  Value: string;
}

interface MoneyObject {
  OriginalPrice?: number;
  MarginPrice?: number;
  ConvertedPrice?: string;
  ConvertedPriceWithoutSign?: string;
  [key: string]: unknown;
}

interface PictureInfo {
  Url?: string;
  [key: string]: unknown;
}

interface ItemConfiguration {
  Id: string;
  Price?: number | MoneyObject;
  PriceRmb?: number | MoneyObject;
  Volume?: number;
  SalesCount?: number;
  [key: string]: unknown;
}

interface PromotionDefinition {
  Price?: number | MoneyObject;
  SalesCount?: number;
  Rating?: number;
  FeaturedValues?: FeaturedValue[];
  [key: string]: unknown;
}

interface OtapiRawProduct {
  Id: string;
  Title?: string;
  OriginalTitle?: string;
  MainPictureUrl?: string;
  Pictures?: PictureInfo[];
  ExternalItemUrl?: string;
  BrandName?: string;
  Price?: number | MoneyObject;
  Volume?: number;
  SalesCount?: number;
  FeaturedValues?: FeaturedValue[];
  ProviderType?: string;
  VendorName?: string;
  VendorDisplayName?: string;
  ConfiguredItems?: ItemConfiguration[];
  ItemConfigurations?: ItemConfiguration[];
  Promotions?: PromotionDefinition[];
  Rating?: number;
  [key: string]: unknown;
}

interface SearchItemsFrameResponse {
  ErrorCode: number | string;
  ErrorDescription?: string;
  Result?: {
    Items?: {
      Content?: OtapiRawProduct[];
      TotalCount?: number;
    };
  };
  RequestId?: string;
  RequestTime?: number;
}

/**
 * Extrae el precio correcto en CNY (yuanes) de promociones/configuraciones/base
 */
function extractCorrectPrice(product: OtapiRawProduct): number {
  // 1. PRIORIDAD: PROMOCIONES
  if (product.Promotions && product.Promotions.length > 0) {
    for (const promo of product.Promotions) {
      if (!promo.Price) continue;
      if (typeof promo.Price === 'object') {
        const price = (promo.Price as MoneyObject).OriginalPrice ?? (promo.Price as MoneyObject).MarginPrice;
        if (price && price > 0) {
          return price;
        }
      } else if (typeof promo.Price === 'number' && promo.Price > 0) {
        return promo.Price;
      }
    }
  }
  // 2. CONFIGURACIONES: mínimo precio válido en CNY
  const configs = product.ConfiguredItems || product.ItemConfigurations;
  if (configs && configs.length > 0) {
    const prices: number[] = [];
    for (const config of configs) {
      const priceObj = config.Price || config.PriceRmb;
      if (!priceObj) continue;
      if (typeof priceObj === 'object') {
        const price = (priceObj as MoneyObject).OriginalPrice ?? (priceObj as MoneyObject).MarginPrice ?? 0;
        if (price > 0) prices.push(price);
      } else if (typeof priceObj === 'number' && priceObj > 0) {
        prices.push(priceObj);
      }
    }
    if (prices.length > 0) {
      return Math.min(...prices);
    }
  }
  // 3. PRECIO BASE
  const directPrice = product.Price;
  if (typeof directPrice === 'object' && directPrice !== null) {
    const priceObj = directPrice as MoneyObject;
    const price = priceObj.OriginalPrice ?? priceObj.MarginPrice ?? 0;
    if (price > 0) return price;
  } else if (typeof directPrice === 'number' && directPrice > 0) {
    return directPrice;
  }
  return 0;
}

/**
 * Extrae el número de ventas desde promociones, featuredValues o configs
 */
function extractSalesCount(product: OtapiRawProduct): number {
  // 1. PROMOCIONES
  if (product.Promotions) {
    for (const promo of product.Promotions) {
      if (typeof promo.SalesCount === 'number' && promo.SalesCount > 0) {
        return promo.SalesCount;
      }
      // Buscar ventas también en promo.FeaturedValues
      if (promo.FeaturedValues) {
        const salesFeature = promo.FeaturedValues.find(f => f.Name?.toLowerCase().includes('sales'));
        if (salesFeature) {
          const val = parseInt(salesFeature.Value.replace(/\D/g, ''), 10);
          if (!isNaN(val) && val > 0) return val;
        }
      }
    }
  }
  // 2. SALES EN FEATURED VALUES
  if (product.FeaturedValues) {
    const salesFeature = product.FeaturedValues.find(f =>
      f.Name?.toLowerCase().includes('sales')
    );
    if (salesFeature) {
      const val = parseInt(salesFeature.Value.replace(/\D/g, ''), 10);
      if (!isNaN(val)) return val;
    }
  }
  // 3. CONFIGS: suma todos los SKUs
  const configs = product.ConfiguredItems || product.ItemConfigurations;
  if (configs && configs.length > 0) {
    const totalSales = configs.reduce(
      (sum, config) => sum + (config.SalesCount || config.Volume || 0),
      0
    );
    if (totalSales > 0) return totalSales;
  }
  // 4. VOLUMEN BASE SI NADA MÁS
  if (typeof product.SalesCount === 'number' && product.SalesCount > 0) return product.SalesCount;
  if (typeof product.Volume === 'number' && product.Volume > 0) return product.Volume;
  return 0;
}

/**
 * Extrae el rating de promociones, featuredValues o campo principal
 */
function extractRating(product: OtapiRawProduct): number | undefined {
  // 1. PROMOCIONES
  if (product.Promotions) {
    for (const promo of product.Promotions) {
      if (typeof promo.Rating === 'number' && promo.Rating > 0) {
        return promo.Rating;
      }
      // Buscar rating también en promo.FeaturedValues
      if (promo.FeaturedValues) {
        const ratingFeature = promo.FeaturedValues.find(f =>
          f.Name?.toLowerCase().includes('rating') ||
          f.Name === 'normalizedRating'
        );
        if (ratingFeature) {
          const val = parseFloat(ratingFeature.Value);
          if (!isNaN(val)) return val * 5;
        }
      }
    }
  }
  // 2. RATING EN FEATURED VALUES
  if (product.FeaturedValues) {
    const ratingFeature = product.FeaturedValues.find(f =>
      f.Name?.toLowerCase().includes('rating') ||
      f.Name === 'normalizedRating'
    );
    if (ratingFeature) {
      const val = parseFloat(ratingFeature.Value);
      if (!isNaN(val)) return val * 5;
    }
  }
  // 3. RATING BASE
  if (typeof product.Rating === 'number' && product.Rating > 0) return product.Rating;
  return undefined;
}

function buildSearchXml(categoryId: string, sortType: string): string {
  let orderBy = 'Volume:Desc';
  switch (sortType) {
    case 'Ranksales': orderBy = 'Volume:Desc'; break;
    case 'Rankprice_asc': orderBy = 'Price:Asc'; break;
    case 'Rankprice_desc': orderBy = 'Price:Desc'; break;
    case 'Ranknew': orderBy = 'CreatedTime:Desc'; break;
  }
  return `<SearchItemsParameters>
    <CategoryId>${categoryId}</CategoryId>
    <OrderBy>${orderBy}</OrderBy>
    <OutputMode>Full</OutputMode>
  </SearchItemsParameters>`;
}

async function getProductFullInfo(
  itemId: string,
  instanceKey: string,
  language: string
): Promise<OtapiRawProduct | null> {
  try {
    const url = new URL('http://otapi.net/service-json/GetItemFullInfo');
    url.searchParams.append('instanceKey', instanceKey);
    url.searchParams.append('language', language);
    url.searchParams.append('itemId', itemId);
    const response = await axios.get(url.toString(), { timeout: 5000 });
    if (response.data.ErrorCode === 0 || response.data.ErrorCode === '0' || response.data.ErrorCode === 'Ok') {
      return response.data.OtapiItemFullInfo as OtapiRawProduct;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function searchProducts(
  categoryId: string,
  instanceKey: string,
  language: string,
  sortType: string,
  pageSize: number
): Promise<{ products: OtapiRawProduct[]; totalCount: number }> {
  const xmlParams = buildSearchXml(categoryId, sortType);
  const allProducts: OtapiRawProduct[] = [];
  let totalCount = 0;
  const batchSize = 100;
  const maxToFetch = Math.min(Math.ceil(pageSize * 1.5), 200);
  for (let position = 0; position < maxToFetch; position += batchSize) {
    try {
      const url = new URL('http://otapi.net/service-json/SearchItemsFrame');
      url.searchParams.append('instanceKey', instanceKey);
      url.searchParams.append('language', language);
      url.searchParams.append('xmlParameters', xmlParams);
      url.searchParams.append('framePosition', position.toString());
      url.searchParams.append('frameSize', batchSize.toString());
      const response = await axios.get<SearchItemsFrameResponse>(url.toString(), { timeout: 30000 });
      if (response.data.ErrorCode !== 0 && response.data.ErrorCode !== '0' && response.data.ErrorCode !== 'Ok') break;
      const items = response.data.Result?.Items?.Content || [];
      totalCount = response.data.Result?.Items?.TotalCount || 0;
      if (items.length === 0) break;
      allProducts.push(...items);
      if (allProducts.length >= maxToFetch || items.length < batchSize) break;
    } catch (error) { break; }
  }
  // SIEMPRE enriquecer TODOS los productos para obtener precios actualizados
  const topProducts = allProducts.slice(0, maxToFetch);
  const enrichedProducts: OtapiRawProduct[] = [];
  const enrichBatchSize = 50;
  for (let i = 0; i < topProducts.length; i += enrichBatchSize) {
    const batch = topProducts.slice(i, i + enrichBatchSize);
    const enrichPromises = batch.map(async (product) => {
      const fullProduct = await getProductFullInfo(product.Id, instanceKey, language);
      if (fullProduct) return fullProduct;
      return product;
    });
    const enrichedBatch = await Promise.all(enrichPromises);
    enrichedProducts.push(...enrichedBatch);
  }
  return { products: enrichedProducts, totalCount };
}

function extractPublishDate(featuredValues?: FeaturedValue[]): string | undefined {
  if (!featuredValues) return undefined;
  const dateFields = ['listTime', 'publishTime', 'createdTime', 'listingTime'];
  for (const fieldName of dateFields) {
    const dateFeature = featuredValues.find(f => f.Name === fieldName);
    if (dateFeature?.Value) return dateFeature.Value;
  }
  return undefined;
}

function mapProduct(product: OtapiRawProduct, rates: { USD: number; COP: number }) {
  const title = product.Title || product.OriginalTitle || 'Sin título';
  const priceRMB = extractCorrectPrice(product);
  const priceUSD = priceRMB * rates.USD;
  const priceCOP = priceRMB * rates.COP;
  const salesCount = extractSalesCount(product);
  const rating = extractRating(product);
  const publishDate = extractPublishDate(product.FeaturedValues);
  const itemUrl = product.ExternalItemUrl || `https://item.taobao.com/item.htm?id=${product.Id}`;
  let imageUrl = product.MainPictureUrl || '';
  if (!imageUrl && product.Pictures && product.Pictures.length > 0) {
    imageUrl = product.Pictures[0].Url || '';
  }
  const shopName = product.VendorDisplayName || product.VendorName || product.BrandName;
  return {
    ItemId: product.Id,
    Title: title,
    ImageUrl: imageUrl,
    ItemUrl: itemUrl,
    Price: priceRMB,
    PriceRMB: priceRMB,
    PriceUSD: priceUSD,
    PriceCOP: priceCOP,
    Currency: 'CNY',
    SalesCount: salesCount,
    Rating: rating,
    ShopName: shopName,
    ProviderType: product.ProviderType,
    PublishDate: publishDate,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceKey = searchParams.get('instanceKey');
    const language = searchParams.get('language') || 'es';
    const categoryId = searchParams.get('categoryId');
    const pageSize = parseInt(searchParams.get('frameSize') || '20');
    const sortType = searchParams.get('sortType') || 'Ranksales';

    if (!instanceKey || !categoryId) {
      return NextResponse.json(
        { error: 'Instance key and category ID are required' },
        { status: 400 }
      );
    }

    const currencyData = await getCachedRates();
    const rates = {
      USD: currencyData.rates.USD,
      COP: currencyData.rates.COP,
    };

    const { products: rawProducts, totalCount } = await searchProducts(
      categoryId,
      instanceKey,
      language,
      sortType,
      pageSize
    );

    if (rawProducts.length === 0) {
      const emptyResponse = {
        ErrorCode: 'Ok',
        Content: [],
        TotalCount: 0,
        RequestId: `req-${Date.now()}`,
        RequestTime: Date.now(),
      };
      return NextResponse.json(emptyResponse);
    }

    const mappedProducts = rawProducts.map((product) => mapProduct(product, rates));

    if (sortType === 'Ranksales') {
      mappedProducts.sort((a, b) => b.SalesCount - a.SalesCount);
    }

    const limitedProducts = mappedProducts.slice(0, pageSize);

    const response = {
      ErrorCode: 'Ok',
      Content: limitedProducts,
      TotalCount: totalCount,
      RequestId: `req-${Date.now()}`,
      RequestTime: Date.now(),
    };

    return NextResponse.json(response);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: error.response?.data?.ErrorDescription || 'Failed to fetch products',
          details: error.message,
        },
        { status: error.response?.status || 500 }
      );
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}