import type { NextConfig } from 'next';

/**
 * El navegador solo habla con Next: `/api/*` se reenvía a la API Nest.
 * Así la cookie `sesion` es de primera parte y no hace falta CORS.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Sin AGENTS.md generado: las reglas del repo viven en CLAUDE.md.
  agentRules: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
