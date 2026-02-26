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
  VendorScore?: number;
  VendorRating?: number;
  ConfiguredItems?: ItemConfiguration[];
  ItemConfigurations?: ItemConfiguration[];
  Promotions?: PromotionDefinition[];
  Rating?: number;
  Weight?: number;
  GrossWeight?: number;
  ItemWeight?: number;
  ActualWeightInfo?: { Type?: string; DisplayName?: string; Weight?: number; Unit?: string };
  WeightInfos?: Array<{ Type?: string; DisplayName?: string; Weight?: number; Unit?: string }>;
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

function extractWeight(product: OtapiRawProduct): { value: number; unit: string } | undefined {
  const p = product as OtapiRawProduct & {
    ActualWeightInfo?: { Weight?: number; Unit?: string };
    WeightInfos?: Array<{ Weight?: number; Unit?: string }>;
  };
  const toUnit = (u?: string) => (u?.toLowerCase() === 'g' ? 'g' : 'kg');

  if (p.ActualWeightInfo && typeof p.ActualWeightInfo.Weight === 'number' && p.ActualWeightInfo.Weight > 0) {
    return { value: p.ActualWeightInfo.Weight, unit: toUnit(p.ActualWeightInfo.Unit) || 'kg' };
  }
  if (p.WeightInfos?.length) {
    const first = p.WeightInfos[0];
    if (typeof first.Weight === 'number' && first.Weight > 0) {
      return { value: first.Weight, unit: toUnit(first.Unit) || 'kg' };
    }
  }
  const asRecord = product as Record<string, unknown>;
  const directKeys = ['Weight', 'GrossWeight', 'ItemWeight'];
  for (const key of directKeys) {
    const val = asRecord[key];
    if (typeof val === 'number' && val > 0) return { value: val, unit: 'kg' };
  }
  if (product.FeaturedValues) {
    const weightFeature = product.FeaturedValues.find(
      (x) => x.Name?.toLowerCase().includes('weight') || (x.Value && /[\d.,]+\s*(kg|g|gram)/i.test(x.Value))
    );
    if (weightFeature?.Value) {
      const num = parseFloat(weightFeature.Value.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        const unit = /(\d+)\s*g\b/i.test(weightFeature.Value) && !/kg/i.test(weightFeature.Value) ? 'g' : 'kg';
        return { value: num, unit };
      }
    }
  }
  return undefined;
}

function extractSellerRating(product: OtapiRawProduct): number | undefined {
  const p = product as OtapiRawProduct & { VendorScore?: number; VendorRating?: number; SellerRating?: number };
  if (typeof p.VendorScore === 'number' && p.VendorScore >= 0) return p.VendorScore;
  if (typeof p.VendorRating === 'number' && p.VendorRating >= 0) return p.VendorRating;
  if (typeof p.SellerRating === 'number' && p.SellerRating >= 0) return p.SellerRating;
  if (product.FeaturedValues) {
    const f = product.FeaturedValues.find(
      (x) => x.Name?.toLowerCase().includes('vendor') && x.Name?.toLowerCase().includes('rating')
    ) || product.FeaturedValues.find((x) => x.Name?.toLowerCase() === 'sellerrating');
    if (f?.Value) {
      const val = parseFloat(f.Value);
      if (!isNaN(val) && val >= 0) return val;
    }
  }
  return undefined;
}

function extractDimensions(product: OtapiRawProduct): { length?: number; width?: number; height?: number; unit: string } | undefined {
  const asRecord = product as Record<string, unknown>;
  const toNum = (v: unknown): number | undefined => {
    if (typeof v === 'number' && !isNaN(v)) return v > 0 ? v : undefined;
    if (typeof v === 'string') return parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;
    return undefined;
  };

  let length: number | undefined;
  let width: number | undefined;
  let height: number | undefined;

  const phys = asRecord.PhysicalParameters;
  if (phys != null && typeof phys === 'object') {
    if (Array.isArray(phys)) {
      for (const item of phys) {
        const it = item as Record<string, unknown>;
        const name = String(it?.Name ?? it?.name ?? '').toLowerCase();
        const val = toNum(it?.Value ?? it?.value);
        if (val === undefined || val <= 0) continue;
        if (length === undefined && (name.includes('length') || name.includes('longitud') || name === 'l')) length = val;
        else if (width === undefined && (name.includes('width') || name.includes('ancho') || name === 'w')) width = val;
        else if (height === undefined && (name.includes('height') || name.includes('alto') || name === 'h')) height = val;
      }
    } else {
      const physKeys = Object.keys(phys);
      const dimKeys = ['Length', 'Width', 'Height', 'ItemLength', 'ItemWidth', 'ItemHeight', 'PackageLength', 'PackageWidth', 'PackageHeight'];
      for (const key of dimKeys) {
        const val = toNum((phys as Record<string, unknown>)[key]);
        if (val === undefined || val <= 0) continue;
        const k = key.toLowerCase();
        if (k.includes('length') && length === undefined) length = val;
        else if (k.includes('width') && width === undefined) width = val;
        else if (k.includes('height') && height === undefined) height = val;
      }
    }
  }

  const directKeys = [
    'Length', 'Width', 'Height',
    'ItemLength', 'ItemWidth', 'ItemHeight',
    'PackageLength', 'PackageWidth', 'PackageHeight',
    'length', 'width', 'height',
  ];
  for (const key of directKeys) {
    const val = toNum(asRecord[key]);
    if (val === undefined) continue;
    const k = key.toLowerCase();
    if (k.includes('length') && length === undefined) length = val;
    else if (k.includes('width') && width === undefined) width = val;
    else if (k.includes('height') && height === undefined) height = val;
  }

  if (product.FeaturedValues) {
    for (const f of product.FeaturedValues) {
      const name = (f.Name ?? '').toLowerCase();
      const val = toNum(f.Value);
      if (val === undefined || val <= 0) continue;
      if (length === undefined && (name.includes('length') || name.includes('longitud') || name === 'l')) length = val;
      else if (width === undefined && (name.includes('width') || name.includes('ancho') || name === 'w')) width = val;
      else if (height === undefined && (name.includes('height') || name.includes('alto') || name === 'h')) height = val;
    }

    const combined = product.FeaturedValues.find(
      (f) => f.Value && /[\d.,]+\s*[*x×]\s*[\d.,]+\s*[*x×]\s*[\d.,]+/i.test(f.Value)
    );
    if (combined?.Value && (length === undefined || width === undefined || height === undefined)) {
      const parts = combined.Value.replace(/,/g, '.').split(/[*x×]/).map((s) => parseFloat(s.replace(/[^\d.]/g, '')));
      const nums = parts.filter((n) => !isNaN(n) && n > 0);
      if (nums.length >= 3) {
        if (length === undefined) length = nums[0];
        if (width === undefined) width = nums[1];
        if (height === undefined) height = nums[2];
      } else if (nums.length === 1 && length === undefined && width === undefined && height === undefined) {
        length = width = height = nums[0];
      }
    }
  }

  const attrs = asRecord.Attributes;
  if (Array.isArray(attrs) && (length === undefined || width === undefined || height === undefined)) {
    const lengthKeys = ['length', 'longitud', 'long', '长', '深度', 'depth'];
    const widthKeys = ['width', 'ancho', 'wide', '宽'];
    const heightKeys = ['height', 'alto', '高', '厚', 'thickness'];
    const dimKeys = ['dimension', '尺寸', '规格', 'package', 'empaque', 'measure', '体积', '包装'];
    const isSizeVariantLabel = (v: string) => /inch|inches|码|号|size\s*[:\-]|\[.+\]/.test(v) || /^\s*\d+\s*[-–]\s*inch/i.test(v);
    for (const a of attrs) {
      const row = a as Record<string, unknown>;
      const name = String(row?.PropertyName ?? row?.OriginalPropertyName ?? row?.name ?? '').toLowerCase();
      const origName = String(row?.OriginalPropertyName ?? '').toLowerCase();
      const valueStr = String(row?.Value ?? row?.OriginalValue ?? row?.value ?? '');
      const combined = `${name} ${origName}`;
      if ((combined.includes('size') || combined.includes('尺寸')) && isSizeVariantLabel(valueStr)) continue;
      const val = toNum(row?.Value ?? row?.OriginalValue ?? row?.value);
      if (val !== undefined && val > 0) {
        if (length === undefined && (lengthKeys.some((k) => combined.includes(k)) || /^l\b|length$/i.test(name))) length = val;
        else if (width === undefined && (widthKeys.some((k) => combined.includes(k)) || /^w\b|width$/i.test(name))) width = val;
        else if (height === undefined && (heightKeys.some((k) => combined.includes(k)) || /^h\b|height$/i.test(name))) height = val;
      }
      if ((length === undefined || width === undefined || height === undefined) && dimKeys.some((k) => combined.includes(k)) && !isSizeVariantLabel(valueStr)) {
        const match = valueStr.match(/[\d.,]+\s*[*x×]\s*[\d.,]+\s*[*x×]\s*[\d.,]+/);
        if (match) {
          const parts = match[0].replace(/,/g, '.').split(/[*x×]/).map((s) => parseFloat(s.replace(/[^\d.]/g, '')));
          const nums = parts.filter((n) => !isNaN(n) && n > 0);
          if (nums.length >= 3) {
            if (length === undefined) length = nums[0];
            if (width === undefined) width = nums[1];
            if (height === undefined) height = nums[2];
          }
        }
      }
    }
  }

  if (length === undefined && width === undefined && height === undefined) return undefined;
  const MIN_CM = 3;
  const validL = length != null && length >= MIN_CM ? length : undefined;
  const validW = width != null && width >= MIN_CM ? width : undefined;
  const validH = height != null && height >= MIN_CM ? height : undefined;
  if (validL === undefined && validW === undefined && validH === undefined) return undefined;
  return { length: validL, width: validW, height: validH, unit: 'cm' };
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

export async function getProductFullInfo(
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
    if (response.data.ErrorCode !== 0 && response.data.ErrorCode !== '0' && response.data.ErrorCode !== 'Ok') {
      return null;
    }
    const full = response.data.OtapiItemFullInfo as Record<string, unknown> | null;
    if (!full || typeof full !== 'object') return null;
    // Algunas APIs devuelven el ítem anidado en .Item; el peso puede estar en el nivel superior
    const item = (full.Item as Record<string, unknown>) || full;
    const merged = { ...item, ...full } as OtapiRawProduct;
    if (item && item !== full && typeof item === 'object') {
      Object.keys(item).forEach((k) => { (merged as Record<string, unknown>)[k] = (item as Record<string, unknown>)[k]; });
    }
    return merged;
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

function extractReviewCount(product: OtapiRawProduct): number | undefined {
  const asRecord = product as Record<string, unknown>;
  if (typeof asRecord.ReviewCount === 'number' && asRecord.ReviewCount >= 0) return asRecord.ReviewCount as number;
  if (typeof asRecord.CommentCount === 'number' && asRecord.CommentCount >= 0) return asRecord.CommentCount as number;
  if (product.FeaturedValues) {
    const reviewFeature = product.FeaturedValues.find(f =>
      f.Name?.toLowerCase().includes('review') || f.Name?.toLowerCase().includes('comment')
    );
    if (reviewFeature?.Value) {
      const val = parseInt(reviewFeature.Value.replace(/\D/g, ''), 10);
      if (!isNaN(val) && val >= 0) return val;
    }
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
  const weightInfo = extractWeight(product);
  const dimensions = extractDimensions(product);
  const rawSellerRating = extractSellerRating(product);
  const sellerRating =
    rawSellerRating != null
      ? rawSellerRating > 5
        ? Math.round((rawSellerRating / 20) * 5 * 10) / 10
        : rawSellerRating
      : undefined;
  const configs = product.ConfiguredItems || product.ItemConfigurations;
  const variantCount = configs?.length ?? 0;
  const L = dimensions?.length ?? 0;
  const W = dimensions?.width ?? 0;
  const H = dimensions?.height ?? 0;
  const hasDimensions = L >= 3 && W >= 3 && H >= 3;
  const VOLUMETRIC_FACTOR = 6000;
  const volumetricWeightKg = hasDimensions ? (L * W * H) / VOLUMETRIC_FACTOR : undefined;
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
    ReviewCount: extractReviewCount(product),
    ShopName: shopName,
    BrandName: product.BrandName,
    VariantCount: variantCount > 0 ? variantCount : undefined,
    ProviderType: product.ProviderType,
    PublishDate: publishDate,
    Weight: weightInfo?.value,
    WeightUnit: weightInfo?.unit,
    Length: dimensions?.length,
    Width: dimensions?.width,
    Height: dimensions?.height,
    DimensionsUnit: dimensions?.unit,
    VolumetricWeightKg: volumetricWeightKg != null ? Math.round(volumetricWeightKg * 100) / 100 : undefined,
    SellerRating: sellerRating,
  };
}

export async function fetchAndMapItemFullInfo(
  itemId: string,
  instanceKey: string,
  language: string
): Promise<ReturnType<typeof mapProduct> | null> {
  const product = await getProductFullInfo(itemId, instanceKey, language);
  if (!product) return null;
  const currencyData = await getCachedRates();
  const rates = { USD: currencyData.rates.USD, COP: currencyData.rates.COP };
  return mapProduct(product, rates);
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

    // En desarrollo: log para ver estructura real y localizar peso
    if (process.env.NODE_ENV === 'development' && rawProducts[0]) {
      const sample = rawProducts[0] as Record<string, unknown>;
      const keys = Object.keys(sample);
      const weightKeys = keys.filter((k) => k.toLowerCase().includes('weight'));
      const featured = (sample.FeaturedValues as Array<{ Name?: string; Value?: string }> | undefined) || [];
      const weightFeatures = featured.filter(
        (f) => f.Name?.toLowerCase().includes('weight') || f.Value?.toLowerCase().includes('weight')
      );
      console.log('📦 [category-products] Sample product keys:', keys.sort().join(', '));
      if (weightKeys.length) console.log('📦 [category-products] Weight-related keys:', weightKeys, weightKeys.map((k) => sample[k]));
      if (weightFeatures.length) console.log('📦 [category-products] FeaturedValues (weight):', weightFeatures);
      if (!weightKeys.length && !weightFeatures.length) console.log('📦 [category-products] No weight fields found in sample. Full keys:', keys);
      
      const dimensionKeywords = ['length', 'width', 'height', 'dimension', 'size', 'package', 'longitud', 'ancho', 'alto', 'cm', 'mm'];
      const dimensionKeys = keys.filter((k) => dimensionKeywords.some((kw) => k.toLowerCase().includes(kw)));
      const dimensionFeatures = featured.filter(
        (f) =>
          dimensionKeywords.some((kw) => (f.Name ?? '').toLowerCase().includes(kw)) ||
          (f.Value && /[\d.,]+\s*[*x×]\s*[\d.,]+/.test(f.Value))
      );
      console.log('📐 [category-products] Dimension-related keys:', dimensionKeys.length ? dimensionKeys : 'none', dimensionKeys.length ? dimensionKeys.map((k) => ({ key: k, value: sample[k] })) : '');
      console.log('📐 [category-products] FeaturedValues (dimensions):', dimensionFeatures.length ? dimensionFeatures : 'none');
      if (!dimensionKeys.length && !dimensionFeatures.length) console.log('📐 [category-products] No dimension fields in sample. All FeaturedValues names:', featured.map((f) => f.Name));
      // PhysicalParameters y Attributes suelen traer dimensiones en OTAPI/Taobao
      if (sample.PhysicalParameters != null) console.log('📐 [category-products] PhysicalParameters:', JSON.stringify(sample.PhysicalParameters));
      const attrs = sample.Attributes as Array<{ PropertyName?: string; OriginalPropertyName?: string; Value?: unknown }> | undefined;
      if (Array.isArray(attrs)) {
        const dimAttrKeywords = ['length', 'width', 'height', 'dimension', 'size', 'package', '长', '宽', '高', '尺寸', '规格', '厚', '深'];
        const dimensionAttrs = attrs.filter(
          (a) =>
            dimAttrKeywords.some((kw) => (a.PropertyName ?? '').toLowerCase().includes(kw) || (a.OriginalPropertyName ?? '').includes(kw))
        );
        if (dimensionAttrs.length) console.log('📐 [category-products] Attributes (dimension-related):', dimensionAttrs.map((a) => ({ PropertyName: a.PropertyName, OriginalPropertyName: a.OriginalPropertyName, Value: a.Value })));
        else console.log('📐 [category-products] All Attribute PropertyNames:', attrs.map((a) => a.PropertyName ?? a.OriginalPropertyName));
      }
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
