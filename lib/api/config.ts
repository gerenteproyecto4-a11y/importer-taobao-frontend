import { Environment } from '@/types/auth';

export const ENVIRONMENTS: Environment[] = [
  {
    name: 'KC Staging',
    url: 'https://kcstaging.mitimiti.com',
  },
  {
    name: 'KC Production',
    url: 'https://kcpro.mitimiti.com',
  },
];

export const API_ENDPOINTS = {
  AUTH: '/rest/V1/integration/admin/token',
};

export const OTAPI_CONFIG = {
  INSTANCE_KEY: '9ce05770-5f30-44c1-bc86-fcd807e4134e',
  BASE_URL: 'http://otapi.net',
  DEFAULT_LANGUAGE: 'es',
  DEFAULT_NUMBER_ITEMS: 20,
};