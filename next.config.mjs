/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Capacitor builds set MOBILE_EXPORT=1 to emit a static bundle the native
  // shell loads locally; the web/PWA build stays a normal server build.
  ...(process.env.MOBILE_EXPORT === '1'
    ? { output: 'export', images: { unoptimized: true }, trailingSlash: true }
    : {}),
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
