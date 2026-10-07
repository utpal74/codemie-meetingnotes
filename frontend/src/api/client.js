import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data;
    const normalized = {
      code: data?.error?.code ?? 'NETWORK_ERROR',
      message: data?.error?.message ?? err.message ?? 'Network error',
      field: data?.error?.field ?? null,
      status: err.response?.status ?? 0,
    };
    return Promise.reject(normalized);
  }
);

export default api;
