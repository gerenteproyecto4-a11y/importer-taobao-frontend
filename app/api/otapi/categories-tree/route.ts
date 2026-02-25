import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Una sola llamada de pago: GetTwoLevelRootCategoryInfoList.
 * Devuelve categorías raíz + subcategorías del primer nivel, para no usar GetCategorySubcategoryInfoList (menos cobro).
 */
interface OtapiRawCategory {
  Id: string;
  Name: string;
  ExternalId?: string;
  IsParent?: boolean;
  IsHidden?: boolean;
  ProviderType?: string;
  ParentId?: string;
  ParentCategoryId?: string;
  Level?: number;
  Subcategories?: OtapiRawCategory[];
  Children?: OtapiRawCategory[];
}

interface OtapiRawResponse {
  ErrorCode: number | string;
  ErrorDescription?: string;
  CategoryInfoList?: {
    Content?: OtapiRawCategory[];
  };
  Content?: OtapiRawCategory[];
  RequestId?: string;
  RequestTime?: number;
}

function toPublicCategory(cat: OtapiRawCategory) {
  return {
    CategoryId: cat.Id,
    Name: cat.Name,
    ExternalId: cat.ExternalId,
    IsParent: cat.IsParent,
    ProviderType: cat.ProviderType,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceKey = searchParams.get('instanceKey');
    const language = searchParams.get('language') || 'es';

    if (!instanceKey) {
      return NextResponse.json(
        { error: 'Instance key is required' },
        { status: 400 }
      );
    }

    const url = new URL('http://otapi.net/service-json/GetTwoLevelRootCategoryInfoList');
    url.searchParams.append('instanceKey', instanceKey);
    url.searchParams.append('language', language);

    const response = await axios.get<OtapiRawResponse>(url.toString(), {
      timeout: 30000,
    });

    if (response.data.ErrorCode !== 0 && response.data.ErrorCode !== 'Ok') {
      return NextResponse.json({
        ErrorCode: response.data.ErrorCode,
        ErrorDescription: response.data.ErrorDescription,
        Content: [],
        SubcategoriesByParentId: {},
        RequestId: response.data.RequestId,
        RequestTime: response.data.RequestTime,
      });
    }

    const rawList = response.data.CategoryInfoList?.Content || response.data.Content || [];
    const rootCategories: ReturnType<typeof toPublicCategory>[] = [];
    const subcategoriesByParentId: Record<string, ReturnType<typeof toPublicCategory>[]> = {};

    const getParentId = (c: OtapiRawCategory) => c.ParentId ?? c.ParentCategoryId;

    if (process.env.NODE_ENV === 'development') {
      console.log('📦 categories-tree raw:', {
        totalItems: rawList.length,
        firstItemKeys: rawList[0] ? Object.keys(rawList[0] as object) : [],
        sampleIds: rawList.slice(0, 3).map((c: OtapiRawCategory) => ({ Id: c.Id, ParentId: getParentId(c) })),
      });
    }
    const first = rawList[0] as OtapiRawCategory | undefined;
    if (first && (Array.isArray(first.Subcategories) || Array.isArray(first.Children))) {
      const childrenKey = Array.isArray(first.Subcategories) ? 'Subcategories' : 'Children';
      for (const root of rawList as OtapiRawCategory[]) {
        if (root.IsHidden) continue;
        rootCategories.push(toPublicCategory(root));
        const children = (root[childrenKey as keyof OtapiRawCategory] as OtapiRawCategory[] | undefined) || [];
        const subs = children
          .filter((c) => !c.IsHidden)
          .map(toPublicCategory);
        if (subs.length) subcategoriesByParentId[root.Id] = subs;
      }
    } else {
      const withParent = rawList.filter((c: OtapiRawCategory) => {
        const pid = getParentId(c);
        return pid !== undefined && pid !== null && String(pid).trim() !== '';
      });
      const roots = rawList.filter((c: OtapiRawCategory) => {
        const pid = getParentId(c);
        return !pid || String(pid).trim() === '' || (c as OtapiRawCategory & { Level?: number }).Level === 0;
      });

      for (const r of roots) {
        if ((r as OtapiRawCategory).IsHidden) continue;
        rootCategories.push(toPublicCategory(r as OtapiRawCategory));
      }
      for (const c of withParent) {
        const cat = c as OtapiRawCategory;
        if (cat.IsHidden) continue;
        const pid = getParentId(cat);
        if (pid) {
          if (!subcategoriesByParentId[pid]) subcategoriesByParentId[pid] = [];
          subcategoriesByParentId[pid].push(toPublicCategory(cat));
        }
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ categories-tree parsed:', {
        rootsCount: rootCategories.length,
        subcategoriesByParentIdKeys: Object.keys(subcategoriesByParentId),
        sampleParentIds: Object.keys(subcategoriesByParentId).slice(0, 5),
      });
    }

    return NextResponse.json({
      ErrorCode: response.data.ErrorCode,
      ErrorDescription: response.data.ErrorDescription,
      Content: rootCategories,
      SubcategoriesByParentId: subcategoriesByParentId,
      RequestId: response.data.RequestId,
      RequestTime: response.data.RequestTime,
    });
  } catch (error) {
    console.error('❌ categories tree Error:', error);
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: error.response?.data?.ErrorDescription || 'Failed to fetch categories tree',
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
