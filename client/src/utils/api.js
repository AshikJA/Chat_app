import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export const apiFetch = (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  return fetch(url, options);
};

export const apiAxios = axios.create({
  baseURL: API_URL,
});

export const getSocketUrl = () => {
  return import.meta.env.VITE_SOCKET_URL || '/';
};
