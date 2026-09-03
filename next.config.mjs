/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep these out of the webpack bundle and let Next trace them as real
  // node_modules instead: the generated Prisma client loads its own schema
  // and engine files at runtime, which a bundler cannot follow.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  // STANDALONE_BUILD=1 emits .next/standalone: the server plus only the files
  // Next traced as needed. Running that is the closest local reproduction of a
  // serverless host, where anything untraced simply is not there.
  ...(process.env.STANDALONE_BUILD === '1' ? { output: 'standalone' } : {}),
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
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie' },
        ],
      },
    ];
  },
};

export default nextConfig;
