/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline runtime scripts; 'unsafe-inline' is required until we wire nonces.
  // In dev, react-refresh + eval are needed.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.lnsoft.com.br https://api.chat.atomos.tech",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy',   value: ContentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control',    value: 'off' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
