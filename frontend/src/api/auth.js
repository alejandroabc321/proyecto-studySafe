import axios from './axios';

export const registerRequest = (user) => axios.post('/auth/registro', user);
export const loginRequest = (user) => axios.post('/auth/login', user);
export const profileRequest = () => axios.get('/auth/yo');
export const refreshRequest = () => axios.post('/auth/refresh');
export const logoutRequest = () => axios.post('/auth/logout');
