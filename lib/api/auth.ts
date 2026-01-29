import axios from 'axios';
import { LoginCredentials, AuthResponse } from '@/types/auth';

export class AuthService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Call our Next.js API route instead of directly calling Magento
      const response = await axios.post<{ token?: string; error?: string }>(
        '/api/auth',
        {
          ...credentials,
          baseUrl: this.baseUrl,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.token) {
        return { token: response.data.token };
      }

      return { error: response.data.error || 'Invalid response from server' };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          return { error: error.response.data.error };
        }
        if (error.response) {
          return {
            error: `Authentication failed: ${error.response.status} - ${error.response.statusText}`,
          };
        } else if (error.request) {
          return {
            error: 'No response from server. Please check your network connection.',
          };
        }
      }
      return {
        error: 'An unexpected error occurred. Please try again.',
      };
    }
  }
}