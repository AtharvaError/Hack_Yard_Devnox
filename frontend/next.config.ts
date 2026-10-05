import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // The dev badge sits in the bottom-left corner, on top of the sidebar's Log out button.
  devIndicators: false,
  // Loading a new city can take a minute; the default proxy timeout is 30 s.
  experimental: { proxyTimeout: 180_000 },
  // The browser only ever talks to this origin; /api is forwarded to FastAPI,
  // so the session cookie is first-party and no CORS setup is needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
