/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uploads.mangadex.org",
      },
      {
        protocol: "https",
        hostname: "*.mangadex.network",
      },
      {
        protocol: "https",
        hostname: "temp.compsci88.com",
      },
      {
        protocol: "https",
        hostname: "official-ongoing-2.gcdn.co",
      },
      {
        protocol: "https",
        hostname: "avt.mkklcdnv6temp.com",
      },
      {
        protocol: "https",
        hostname: "*.mkklcdnv6tempv5.com",
      },
      {
        protocol: "https",
        hostname: "mangakakalot.com",
      },
      {
        protocol: "https",
        hostname: "chapmanganato.to",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
