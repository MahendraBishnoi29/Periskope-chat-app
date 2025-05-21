import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kdyadcpyuiicxwjvlhiv.supabase.co",
        pathname: "/storage/v1/object/public/chat-attachments/**",
      },
    ],
  },
};

export default nextConfig;
