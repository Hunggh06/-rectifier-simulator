/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: app is pure client-side (data bundled, no API/SSR)
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
