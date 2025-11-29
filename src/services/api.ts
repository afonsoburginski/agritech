import axios, { AxiosInstance, AxiosError } from 'axios';
import { storage } from './storage';

const API_BASE_URL = 'https://web.agrov.com.br';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - adiciona token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await storage.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - trata 401
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Apenas limpar storage se for erro de autenticação E não for endpoint de login
        // (no login, não há token ainda, então não devemos limpar)
        const isLoginEndpoint = error.config?.url?.includes('/mobile/auth/login');
        if (
          error.response?.status === 401 &&
          !isLoginEndpoint
        ) {
          // Token inválido - limpar storage e redirecionar para login
          await storage.clearAll();
          // O auth-store vai lidar com o redirecionamento via _layout.tsx
        }
        return Promise.reject(error);
      }
    );
  }

  get instance(): AxiosInstance {
    return this.api;
  }
}

export const api = new ApiService().instance;
