export interface OtapiItem {
  ItemId: string;
  Title: string;
  Price: number;              // Deprecated - use PriceRMB instead
  PriceRMB: number;           // Price in Chinese Yuan (CNY)
  PriceUSD: number;           // Price in US Dollars
  PriceCOP: number;           // Price in Colombian Pesos
  Currency: string;           // Base currency: "CNY"
  OriginalPrice?: number;
  SalesCount: number;         // Aseguramos que sea número
  ImageUrl: string;
  ItemUrl: string;
  Rating?: number;
  ReviewCount?: number;
  ShopName?: string;
  ProviderType?: string;
  PublishDate?: string;       // Publication date of the product
  ConfigurationId?: string;   // Configuration/SKU ID if exists
}

export interface OtapiCategory {
  CategoryId: string;
  Name: string;
  ExternalId?: string;
  IsParent?: boolean;
  ProviderType?: string;
  ImageUrl?: string;
  ItemCount?: number;
}

export interface OtapiResponse<T> {
  ErrorCode: number | string;
  ErrorDescription?: string;
  Content?: T[];
  TotalCount?: number;
  RequestId?: string;
  RequestTime?: number;
}

export interface OtapiCategoriesTreeResponse {
  ErrorCode: number | string;
  ErrorDescription?: string;
  Content?: OtapiCategory[];
  SubcategoriesByParentId?: Record<string, OtapiCategory[]>;
  RequestId?: string;
  RequestTime?: number;
}
