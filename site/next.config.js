/** @type {import('next').NextConfig} */
const nextConfig = {
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
