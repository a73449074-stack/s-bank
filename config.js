// Frontend can import this to know where to call
// Use empty base in production so code builds '/api/...'.
// Keep explicit localhost for local development.
(function () {
  const stored = localStorage.getItem('apiBaseUrl');
  let defaultBase = 'https://securebank-backend.onrender.com';
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      defaultBase = 'http://localhost:4000';
    }
  } catch (_) {
    // keep default
  }
  window.AppConfig = {
    apiBaseUrl: stored || defaultBase
  };
})();
