import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:3002/api' : '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('porto-token-v1');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle unauthorized errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Trigger logout if token expired/invalid
      localStorage.removeItem('porto-token-v1');
      localStorage.removeItem('porto-user-v1');
      // We can also redirect or reload the window
      if (!window.location.pathname.includes('/login')) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  },
);
