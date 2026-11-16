import type { NextConfig } from "next";

// URL del backend BetterAuth. En desarrollo local apunta al backend en
// localhost:3001; dentro de Docker Compose el servicio `web` debe definir
// BACKEND_URL=http://api:3001 (ver docker-compose.yml).
const backendURL = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Proxy: el navegador solo habla con su mismo origen
  // (http://localhost:3000/api/auth/*) y Next reenvia al backend lado
  // servidor. Asi CORS, preflights y orígenes alternos (127.0.0.1, IPs de
  // red) dejan de afectar al flujo de login/registro.
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${backendURL}/api/auth/:path*`,
      },
      // US 2.1: GraphQL de dominio y uploads REST via mismo origen
      // (evita CORS y reenvia el header Authorization al backend).
      {
        source: "/api/graphql",
        destination: `${backendURL}/graphql`,
      },
      {
        source: "/api/projects/:path*",
        destination: `${backendURL}/projects/:path*`,
      },
      // US 5.2: Subida de evidencia de tareas (Milestones)
      {
        source: "/api/milestones/:path*",
        destination: `${backendURL}/milestones/:path*`,
      },
      // F1-05: Descarga protegida y streaming de documentos (RNF-005)
      {
        source: "/api/documents/:path*",
        destination: `${backendURL}/documents/:path*`,
      },
      // F1-10: Descarga del dictamen PDF (RF-019)
      {
        source: "/api/decisions/:path*",
        destination: `${backendURL}/decisions/:path*`,
      },
      // F2-05: Exportacion de reportes CSV/PDF (RF-008)
      {
        source: "/api/reports/:path*",
        destination: `${backendURL}/reports/:path*`,
      },
    ];
  },
};

export default nextConfig;