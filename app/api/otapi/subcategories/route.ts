import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface OtapiRawCategory {
  Id: string;
  Name: string;
  ExternalId?: string;
  IsParent?: boolean;
  IsHidden?: boolean;
  IsInternal?: boolean;
  IsVirtual?: boolean;
  ProviderType?: string;
}

interface OtapiRawResponse {
  ErrorCode: number | string;
  ErrorDescription?: string;
  CategoryInfoList?: {
    Content?: OtapiRawCategory[];
  };
  RequestId?: string;
  RequestTime?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceKey = searchParams.get('instanceKey');
    const language = searchParams.get('language') || 'es'; // Español por defecto
    const parentCategoryId = searchParams.get('parentCategoryId');

    console.log('📥 Subcategories params:', { instanceKey, language, parentCategoryId });

    if (!instanceKey) {
      return NextResponse.json(
        { error: 'Instance key is required' },
        { status: 400 }
      );
    }

    if (!parentCategoryId) {
      return NextResponse.json(
        { error: 'Parent category ID is required' },
        { status: 400 }
      );
    }

    const url = new URL('http://otapi.net/service-json/GetCategorySubcategoryInfoList');
    url.searchParams.append('instanceKey', instanceKey);
    url.searchParams.append('language', language);
    url.searchParams.append('parentCategoryId', parentCategoryId);

    console.log('🔍 Getting subcategories:', url.toString());

    const response = await axios.get<OtapiRawResponse>(url.toString(), {
      timeout: 30000,
    });

    console.log('✅ Subcategories Raw Response:', {
      ErrorCode: response.data.ErrorCode,
      HasCategoryInfoList: !!response.data.CategoryInfoList,
      Count: response.data.CategoryInfoList?.Content?.length || 0
    });

    // Mapear subcategorías al formato esperado
    const subcategories = (response.data.CategoryInfoList?.Content || [])
      .filter((cat: OtapiRawCategory) => !cat.IsHidden)
      .map((cat: OtapiRawCategory) => ({
        CategoryId: cat.Id,
        Name: cat.Name,
        ExternalId: cat.ExternalId,
        IsParent: cat.IsParent,
        ProviderType: cat.ProviderType
      }));

    return NextResponse.json({
      ErrorCode: response.data.ErrorCode,
      ErrorDescription: response.data.ErrorDescription,
      Content: subcategories,
      RequestId: response.data.RequestId,
      RequestTime: response.data.RequestTime
    });
  } catch (error) {
    console.error('❌ Subcategories Error:', error);
    
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: error.response?.data?.ErrorDescription || 'Failed to fetch subcategories',
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