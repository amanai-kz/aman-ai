import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  serverExternalPackages: ["twilio", "resend"],
  allowedDevOrigins: ["192.168.124.26"],
};

export default nextConfig;
