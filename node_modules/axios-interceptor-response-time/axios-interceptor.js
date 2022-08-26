const axios = require('axios').default;

module.exports = () => {
  // Request
  axios.interceptors.request.use((x) => {
    // to avoid overwriting if another interceptor
    // already defined the same object (meta)
    x.meta = x.meta || {};
    x.meta.requestStartedAt = new Date().getTime();
  });

  axios.interceptors.response.use(
    // Success 200
    (x) => {
      // Get elapsed time (in milliseconds)
      x.responseTime = new Date().getTime() - x.config.meta.requestStartedAt;
      return x;
    },
    // Handle 4xx & 5xx responses
    (x) => {
      // Get elapsed time (in milliseconds)
      x.responseTime = new Date().getTime() - x.config.meta.requestStartedAt;
      return x;
    }
  );

  return axios;
}