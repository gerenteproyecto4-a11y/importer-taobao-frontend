import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface OtapiRawCategory {
  Id: string;
  Name: string;
  ExternalId?: string;
  IsParent?: boolean;
  IsHidden?: boolean;
  ProviderType?: string;
}

interface OtapiRawResponse {
  ErrorCode: number | string;
  ErrorDescription?: string;
  CategoryInfoList?: {
    Content?: OtapiRawCategory[];
  };
  Content?: OtapiRawCategory[]; // A veces viene directo en Content
  RequestId?: string;
  RequestTime?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceKey = searchParams.get('instanceKey');
    const language = searchParams.get('language') || 'es';

    console.log('📥 Received params:', { instanceKey, language });

    if (!instanceKey) {
      return NextResponse.json(
        { error: 'Instance key is required' },
        { status: 400 }
      );
    }

    // Usar GetRootCategoryInfoList que devuelve SOLO las categorías raíz
    const url = new URL('http://otapi.net/service-json/GetRootCategoryInfoList');
    url.searchParams.append('instanceKey', instanceKey);
    url.searchParams.append('language', language);

    console.log('🔍 Calling OT API:', url.toString());

    const response = await axios.get<OtapiRawResponse>(url.toString(), {
      timeout: 30000,
    });

    console.log('✅ OT API Response:', {
      ErrorCode: response.data.ErrorCode,
      HasCategoryInfoList: !!response.data.CategoryInfoList,
      HasDirectContent: !!response.data.Content,
      Count: response.data.CategoryInfoList?.Content?.length || response.data.Content?.length || 0,
      Language: language
    });

    // Intentar obtener de CategoryInfoList o directamente de Content
    const categories = response.data.CategoryInfoList?.Content || response.data.Content || [];
    
    // Filtrar y mapear
    const rootCategories = categories
      .filter((cat: OtapiRawCategory) => !cat.IsHidden)
      .map((cat: OtapiRawCategory) => ({
        CategoryId: cat.Id,
        Name: cat.Name,
        ExternalId: cat.ExternalId,
        IsParent: cat.IsParent,
        ProviderType: cat.ProviderType
      }));

    console.log('✅ Root Categories:', {
      Count: rootCategories.length,
      FirstCategory: rootCategories[0]?.Name || 'None',
      SampleCategories: rootCategories.slice(0, 5).map(c => c.Name)
    });

    return NextResponse.json({
      ErrorCode: response.data.ErrorCode,
      ErrorDescription: response.data.ErrorDescription,
      Content: rootCategories,
      RequestId: response.data.RequestId,
      RequestTime: response.data.RequestTime
    });
  } catch (error) {
    console.error('❌ Categories Error:', error);
    
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: error.response?.data?.ErrorDescription || 'Failed to fetch categories',
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