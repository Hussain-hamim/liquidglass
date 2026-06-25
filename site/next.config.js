/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@ybouane/liquidglass", "@samasante/liquid-glass"],
  async redirects() {
    return [
      {
        source: "/liquidglass",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
