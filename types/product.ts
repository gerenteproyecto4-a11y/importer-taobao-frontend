export interface OtapiItem {
  ItemId: string;
  Title: string;
  Price: number;
  PriceRMB: number;
  PriceUSD: number;
  PriceCOP: number;
  Currency: string;
  OriginalPrice?: number;
  SalesCount: number;
  ImageUrl: string;
  ItemUrl: string;
  Rating?: number;
  ReviewCount?: number;
  ShopName?: string;
  BrandName?: string;
  VariantCount?: number;
  IsConfigurable?: boolean;
  ProviderType?: string;
  PublishDate?: string;
  ConfigurationId?: string;
  Weight?: number;
  WeightUnit?: string;
  Length?: number;
  Width?: number;
  Height?: number;
  DimensionsUnit?: string;
  VolumetricWeightKg?: number;
  SellerRating?: number;

  Description?: string[];
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
export interface ConfiguratorPair {
  Pid: string;
  Vid: string;
}

export interface ItemDetailConfiguration {
  Id: string;
  PriceRmb?: number;
  SalesCount?: number;
  Quantity?: number;
  Configurators?: ConfiguratorPair[];
  PriceUsd?: number;
}

export interface VariantAttributeValue {
  valueId: string;
  valueName?: string;
}

export interface VariantAttributeSummary {
  propertyId: string;
  propertyName?: string;
  values: VariantAttributeValue[];
}

export interface VariantOptionResolved {
  propertyId: string;
  propertyName?: string;
  valueId: string;
  valueName?: string;
}

export interface VariantWithPrice {
  id: string;
  idOriginal?: string;
  priceRmb?: number;
  priceUsd?: number;
  quantity?: number;
  salesCount?: number;
  configurators?: ConfiguratorPair[];
  options?: VariantOptionResolved[];
}

export interface ItemDetailResponse {
  item: OtapiItem;
  pictures: string[];
  configurations: ItemDetailConfiguration[];
}

export interface ProductWithFullDetail {
  item: OtapiItem;
  pictures: string[];
  configurations: ItemDetailConfiguration[];
}

export interface ExportProductSummary {
  item: OtapiItem;
  pictures: string[];
  variantAttributes: VariantAttributeSummary[];
  variants: VariantWithPrice[];
}

export interface ExportProductsFullResponse {
  generatedAt: string;
  instanceKey: string;
  language: string;
  productCount: number;
  categoryId?: string | null;
  categoryName?: string | null;
  sourceType: string;
  products: ExportProductSummary[];
}
