export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token?: string;
  message?: string;
  error?: string;
}

export interface Environment {
  name: string;
  url: string;
}
