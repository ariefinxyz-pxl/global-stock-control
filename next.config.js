/** @type {import('next').NextConfig} */
// Build web biasa (npm run dev / Vercel): mode server.
// Build APK & EXE (npm run build:static): diekspor menjadi file statis di folder "out".
const isStatic = process.env.BUILD_TARGET === 'static';

const nextConfig = {
  reactStrictMode: true,
  ...(isStatic ? { output: 'export', trailingSlash: true, images: { unoptimized: true } } : {}),
  webpack: (config, { isServer }) => {
    // SheetJS memeriksa modul Node saat dibundel untuk browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
