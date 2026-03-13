import { getCachedRates } from '@/app/api/currency/route';
import type {
  ExportProductsFullResponse,
  ExportProductSummary,
  ProductWithFullDetail,
  VariantAttributeSummary,
  VariantAttributeValue,
  VariantOptionResolved,
  VariantWithPrice,
} from '@/types/product';
import { NextRequest, NextResponse } from 'next/server';
import { buildProductDetailFromRaw } from '../build-product-detail';
import { getItemConfigurationDetails, getProductFullInfo } from '../category-products/route';

const MAX_ITEMS = 100;
const COLOMBIA_TZ = 'America/Bogota';

function getGeneratedAtColombia(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  const y = get('year');
  const m = get('month');
  const d = get('day');
  const h = get('hour');
  const min = get('minute');
  const s = get('second');
  return `${y}-${m}-${d}T${h}:${min}:${s}-05:00`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const itemIds = Array.isArray(body.itemIds) ? (body.itemIds as string[]) : [];
    const instanceKey = typeof body.instanceKey === 'string' ? body.instanceKey : null;
    const language = typeof body.language === 'string' ? body.language : 'es';
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : null;
    const categoryName = typeof body.categoryName === 'string' ? body.categoryName : null;

    if (!instanceKey || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'instanceKey and itemIds (non-empty array) are required' },
        { status: 400 }
      );
    }

    const limitedIds = itemIds.slice(0, MAX_ITEMS);
    const currencyData = await getCachedRates();
    const rates = { USD: currencyData.rates.USD, COP: currencyData.rates.COP };

    const products: ExportProductSummary[] = [];

    for (const itemId of limitedIds) {
      const id = String(itemId).trim();
      if (!id) continue;

      const raw = await getProductFullInfo(id, instanceKey, language);
      if (!raw) {
        const fallback: ExportProductSummary = {
          item: {
            ItemId: id,
            Title: 'No disponible',
            PriceRMB: 0,
            Price: 0,
            PriceUSD: 0,
            PriceCOP: 0,
            Currency: 'CNY',
            SalesCount: 0,
            ImageUrl: '',
            ItemUrl: `https://item.taobao.com/item.htm?id=${id}`,
          },
          pictures: [],
          variantAttributes: [],
          variants: [],
        };
        products.push(fallback);
        continue;
      }

      const full: ProductWithFullDetail = buildProductDetailFromRaw(raw, rates);
      const configurations = Array.isArray(full.configurations) ? full.configurations : [];

      const variantMap = new Map<string, Set<string>>();
      for (const cfg of configurations) {
        if (!cfg.Configurators) continue;
        for (const pair of cfg.Configurators) {
          const pid = pair.Pid;
          const vid = pair.Vid;
          if (!pid || !vid) continue;
          if (!variantMap.has(pid)) {
            variantMap.set(pid, new Set<string>());
          }
          variantMap.get(pid)!.add(vid);
        }
      }

      const rawAny = raw as any;
      const rawAttributes: any[] = (Array.isArray(rawAny.Attributes) && rawAny.Attributes) || [];

      const namesByProperty = new Map<
        string,
        { propertyName?: string; values: Map<string, string | undefined> }
      >();

      for (const attr of rawAttributes) {
        if (!attr || attr.IsConfigurator !== true) continue;
        const pid: string | undefined = attr.Pid;
        const vid: string | undefined = attr.Vid;
        if (!pid || !vid) continue;
        const propertyName: string | undefined = attr.PropertyName ?? attr.OriginalPropertyName;
        const valueName: string | undefined = attr.Value ?? attr.OriginalValue;

        if (!namesByProperty.has(pid)) {
          namesByProperty.set(pid, { propertyName, values: new Map() });
        }
        const entry = namesByProperty.get(pid)!;
        if (!entry.propertyName && propertyName) {
          entry.propertyName = propertyName;
        }
        if (!entry.values.has(vid)) {
          entry.values.set(vid, valueName);
        }
      }

      const variantAttributes: VariantAttributeSummary[] = Array.from(variantMap.entries()).map(
        ([propertyId, valueSet]) => {
          const byProperty = namesByProperty.get(propertyId);
          const propertyName = byProperty?.propertyName;
          const values: VariantAttributeValue[] = Array.from(valueSet).map((valueId) => ({
            valueId,
            valueName: byProperty?.values.get(valueId),
          }));
          return {
            propertyId,
            propertyName,
            values,
          };
        }
      );

      const attrByPid = new Map(variantAttributes.map((a) => [a.propertyId, a]));

      const productItemId = full.item.ItemId;

      const hasOtSessionIds = configurations.some(
        (c) => c.Id != null && /^ot-s-/.test(String(c.Id))
      );
      const numericIdByKey = hasOtSessionIds
        ? await getItemConfigurationDetails(productItemId, instanceKey, language)
        : new Map<string, string>();

      const variants: VariantWithPrice[] = configurations.map((c, index) => {
        const options: VariantOptionResolved[] = [];
        if (c.Configurators) {
          for (const { Pid, Vid } of c.Configurators) {
            const attr = attrByPid.get(Pid);
            const valueName = attr?.values.find((v) => v.valueId === Vid)?.valueName;
            options.push({
              propertyId: Pid,
              propertyName: attr?.propertyName,
              valueId: Vid,
              valueName,
            });
          }
        }

        const rawId = c.Id != null ? String(c.Id) : '';
        const isOtSessionId = rawId.length > 0 && /^ot-s-/.test(rawId);
        const compositeKey =
          c.Configurators && c.Configurators.length > 0
            ? c.Configurators.slice()
                .sort((a, b) => a.Pid.localeCompare(b.Pid) || a.Vid.localeCompare(b.Vid))
                .map((x) => `${x.Pid}:${x.Vid}`)
                .join(',')
            : '';
        const resolvedNumericId = compositeKey ? numericIdByKey.get(compositeKey) : undefined;
        const useResolvedId = isOtSessionId && resolvedNumericId;
        const stableId = useResolvedId
          ? resolvedNumericId
          : isOtSessionId || !rawId
            ? `${productItemId}-${compositeKey || index}`
            : rawId;
        const idOriginal = isOtSessionId && !useResolvedId ? rawId : undefined;

        return {
          id: stableId,
          ...(idOriginal ? { idOriginal } : {}),
          priceRmb: c.PriceRmb,
          priceUsd: c.PriceUsd,
          quantity: c.Quantity,
          salesCount: c.SalesCount,
          configurators: c.Configurators,
          options: options.length > 0 ? options : undefined,
        };
      });

      const summary: ExportProductSummary = {
        item: full.item,
        pictures: full.pictures,
        variantAttributes,
        variants,
      };

      products.push(summary);
    }

    const response: ExportProductsFullResponse = {
      generatedAt: getGeneratedAtColombia(),
      instanceKey,
      language,
      productCount: products.length,
      categoryId,
      categoryName,
      sourceType: 'taobao_otc',
      products,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[export-products-full]', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
