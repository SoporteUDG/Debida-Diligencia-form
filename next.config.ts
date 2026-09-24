import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Carga ./src/i18n/request.ts (idioma desde la cookie NEXT_LOCALE)
const withNextIntl = createNextIntlPlugin();

/**
 * Orígenes autorizados a embeber /view en un iframe.
 * Solo aplica a /view (consulta de expediente, solo lectura y autenticada por
 * token en la URL). El resto del sitio sigue bloqueado con frame-ancestors 'none'.
 */
const VIEW_FRAME_ANCESTORS = [
  "'self'",
  "https://*.zoho.com",
  "https://*.zohoapis.com",
].join(" ");

/** Política base, idéntica para todas las rutas salvo frame-ancestors. */
const CSP_BASE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.zoho.com https://*.zohoapis.com",
  "connect-src 'self' https://*.zohoapis.com https://unpkg.com",
].join("; ");

const COMMON_HEADERS = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // /view: embebible únicamente por los orígenes de VIEW_FRAME_ANCESTORS.
        // Sin X-Frame-Options: no admite lista blanca (ALLOW-FROM está obsoleto)
        // y un DENY heredado anularía frame-ancestors en navegadores antiguos.
        source: "/view",
        headers: [
          ...COMMON_HEADERS,
          {
            key: "Content-Security-Policy",
            value: `${CSP_BASE}; frame-ancestors ${VIEW_FRAME_ANCESTORS};`,
          },
        ],
      },
      {
        // Todo lo demás (incluye /admin, /persona-*, /api): framing prohibido.
        // El source excluye /view para no emitir dos cabeceras CSP en esa ruta:
        // el navegador aplicaría la intersección y 'none' volvería a ganar.
        source: "/((?!view/?$).*)",
        headers: [
          ...COMMON_HEADERS,
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Content-Security-Policy",
            value: `${CSP_BASE}; frame-ancestors 'none';`,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
