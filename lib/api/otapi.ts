import axios from 'axios';
import { OtapiResponse, OtapiCategory, OtapiItem, OtapiCategoriesTreeResponse } from '@/types/product';

export class OtApiService {
  async getCategoriesTree(instanceKey: string, language: string = 'es'): Promise<OtapiCategoriesTreeResponse> {
    try {
      const response = await axios.get<OtapiCategoriesTreeResponse>(
        '/api/otapi/categories-tree',
        { params: { instanceKey, language } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to fetch categories tree');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async getCategories(instanceKey: string, language: string = 'es'): Promise<OtapiResponse<OtapiCategory>> {
    try {
      const response = await axios.get<OtapiResponse<OtapiCategory>>(
        '/api/otapi/root-categories',
        { params: { instanceKey, language } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to fetch categories');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async getSubcategories(
    instanceKey: string,
    parentCategoryId: string,
    language: string = 'es'
  ): Promise<OtapiResponse<OtapiCategory>> {
    try {
      const response = await axios.get<OtapiResponse<OtapiCategory>>(
        '/api/otapi/subcategories',
        { params: { instanceKey, parentCategoryId, language } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to fetch subcategories');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  async getBestSellingProducts(params: {
    instanceKey: string;
    categoryId: string;
    language?: string;
    framePosition?: number;
    frameSize?: number;
    sortType?: string;  // Agregar este parámetro
  }): Promise<OtapiResponse<OtapiItem>> {
    try {
      const response = await axios.get<OtapiResponse<OtapiItem>>(
        '/api/otapi/category-products',
        { params }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to fetch products');
      }
      throw new Error('An unexpected error occurred');
    }
  }
}
