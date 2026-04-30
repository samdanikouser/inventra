/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint runs during `next build`. We rely on `tsc --noEmit` for type
  // correctness; ESLint is style/lint and shouldn't fail production deploys.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // The `tsc` step still runs during build — TypeScript errors WILL fail it,
  // which is what we want.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow rendering item photos hosted on the Django API (Render or local dev).
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.onrender.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
