/** @type {import('next').NextConfig} */
const nextConfig = {
  // IMPORTANT : pas de "output: 'export'"
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true }
};
module.exports = nextConfig;
