import { mapProduct } from './category-products/route';
import type { ItemDetailConfiguration, ProductWithFullDetail } from '@/types/product';

type OtapiRawProduct = Parameters<typeof mapProduct>[0];
type MappedItem = ReturnType<typeof mapProduct>;

function extractConfigPrice(priceObj: unknown): number | undefined {
  if (priceObj == null) return undefined;
  if (typeof priceObj === 'number' && priceObj > 0) return priceObj;
  if (typeof priceObj === 'object') {
    const o = priceObj as { OriginalPrice?: number; MarginPrice?: number };
    const p = o.OriginalPrice ?? o.MarginPrice;
    if (typeof p === 'number' && p > 0) return p;
  }
  return undefined;
}

function extractConfigPriceUsd(priceObj: unknown): number | undefined {
  if (priceObj == null || typeof priceObj !== 'object') return undefined;
  const o = priceObj as {
    ConvertedPriceList?: {
      DisplayedMoneys?: Array<{ Price?: number; Code?: string }>;
      Internal?: { Price?: number; Code?: string };
    };
    ConvertedPriceWithoutSign?: string;
  };
  const list = o.ConvertedPriceList?.DisplayedMoneys ?? o.ConvertedPriceList?.Internal;
  if (Array.isArray(list) && list.length > 0) {
    const usd = list.find((m) => m.Code === 'USD');
    if (usd?.Price != null) return usd.Price;
    if (list[0]?.Price != null) return list[0].Price;
  }
  if (o.ConvertedPriceWithoutSign != null) {
    const n = parseFloat(o.ConvertedPriceWithoutSign);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function buildConfigurations(raw: OtapiRawProduct): ItemDetailConfiguration[] {
  const configs = raw.ConfiguredItems ?? raw.ItemConfigurations ?? [];
  return configs.map(
    (c: {
      Id: string;
      Price?: unknown;
      PriceRmb?: unknown;
      SalesCount?: number;
      Quantity?: number;
      Configurators?: Array<{ Pid?: string; Vid?: string }>;
    }) => {
      const priceObj = c.Price ?? c.PriceRmb;
      const priceRmb = extractConfigPrice(priceObj);
      const priceUsd =
        typeof priceObj === 'object' && priceObj !== null ? extractConfigPriceUsd(priceObj) : undefined;
      const configurators =
        Array.isArray(c.Configurators) && c.Configurators.length > 0
          ? c.Configurators.map((x) => ({ Pid: String(x.Pid ?? ''), Vid: String(x.Vid ?? '') }))
          : undefined;
      return {
        Id: c.Id,
        PriceRmb: priceRmb,
        SalesCount: typeof c.SalesCount === 'number' ? c.SalesCount : undefined,
        Quantity: typeof c.Quantity === 'number' ? c.Quantity : undefined,
        Configurators: configurators,
        PriceUsd: priceUsd,
      };
    }
  );
}

function buildPictures(raw: OtapiRawProduct, fallbackImageUrl: string): string[] {
  const pictures: string[] = [];
  if (raw.MainPictureUrl) pictures.push(raw.MainPictureUrl);
  const extraPics = raw.Pictures ?? [];
  for (const p of extraPics) {
    const url = (p as { Url?: string }).Url;
    if (url && !pictures.includes(url)) pictures.push(url);
  }
  if (pictures.length === 0 && fallbackImageUrl) pictures.push(fallbackImageUrl);
  return pictures;
}

/**
 * Construye el detalle completo (item + pictures + configurations) a partir del producto crudo de OTAPI.
 * Usado por item-detail (un producto) y export-products-full (N productos).
 */
export function buildProductDetailFromRaw(
  raw: OtapiRawProduct,
  rates: { USD: number; COP: number }
): ProductWithFullDetail {
  const item: MappedItem = mapProduct(raw, rates);
  const pictures = buildPictures(raw, item.ImageUrl);
  const configurations = buildConfigurations(raw);
  return {
    item,
    pictures,
    configurations,
  };
}
