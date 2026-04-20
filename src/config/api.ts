const CONFIG = {
  development: {
    API_URL: 'http://localhost:3001', // Or your local IP for physical devices
    SOCKET_URL: 'http://localhost:3001',
  },
  production: {
    API_URL: 'https://knot-kbm1.onrender.com',
    SOCKET_URL: 'https://knot-kbm1.onrender.com',
  },
};

const getEnvConfig = () => {
  if (__DEV__) {
    return CONFIG.development;
  }
  return CONFIG.production;
};

export const { API_URL, SOCKET_URL } = getEnvConfig();
export default getEnvConfig();
