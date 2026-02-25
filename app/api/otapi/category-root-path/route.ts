import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * GetCategoryRootPath – FREE method.
 * Returns the parent categories list (breadcrumb path) for a category.
 */
interface OtapiRawCategory {
  Id: string;
  Name: string;
  ExternalId?: string;
  IsParent?: boolean;
  ProviderType?: string;
}

interface OtapiRawResponse {
  ErrorCode: number | string;
  ErrorDescription?: string;
  Content?: OtapiRawCategory[];
  CategoryPath?: OtapiRawCategory[];
  RequestId?: string;
  RequestTime?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceKey = searchParams.get('instanceKey');
    const language = searchParams.get('language') || 'es';
    const categoryId = searchParams.get('categoryId')?.trim();

    if (!instanceKey) {
      return NextResponse.json(
        { error: 'Instance key is required' },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    const url = new URL('http://otapi.net/service-json/GetCategoryRootPath');
    url.searchParams.append('instanceKey', instanceKey);
    url.searchParams.append('language', language);
    url.searchParams.append('categoryId', categoryId);

    const response = await axios.get<OtapiRawResponse>(url.toString(), {
      timeout: 15000,
    });

    if (response.data.ErrorCode !== 0 && response.data.ErrorCode !== 'Ok') {
      return NextResponse.json({
        ErrorCode: response.data.ErrorCode,
        ErrorDescription: response.data.ErrorDescription,
        Content: [],
        RequestId: response.data.RequestId,
        RequestTime: response.data.RequestTime,
      });
    }

    const rawList = response.data.Content || response.data.CategoryPath || [];
    const content = Array.isArray(rawList)
      ? rawList.map((c: OtapiRawCategory) => ({
          CategoryId: c.Id,
          Name: c.Name,
          ExternalId: c.ExternalId,
          IsParent: c.IsParent,
          ProviderType: c.ProviderType,
        }))
      : [];

    return NextResponse.json({
      ErrorCode: response.data.ErrorCode,
      ErrorDescription: response.data.ErrorDescription,
      Content: content,
      RequestId: response.data.RequestId,
      RequestTime: response.data.RequestTime,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: error.response?.data?.ErrorDescription || 'Failed to get category path',
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
