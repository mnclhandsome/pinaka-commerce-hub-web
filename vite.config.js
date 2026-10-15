import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
 
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "https://pch.alektasolutions.com";
  const authProxyTarget = env.VITE_AUTH_PROXY_TARGET || proxyTarget;
 
  const proxy = {};
 
  if (authProxyTarget) {
    proxy["/api/v1/auth"] = {
      target: authProxyTarget,
      changeOrigin: true,
      secure: false,
    };
    proxy["/api/v1/users"] = {
      target: authProxyTarget,
      changeOrigin: true,
      secure: false,
    };
  }
 
  if (proxyTarget) {
    proxy["/uploads/employees"] = { target: proxyTarget, changeOrigin: true, secure: false };
    proxy["/api"] = {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
    };
    proxy["/connector"] = {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
    };
  }
 
  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
                return "vendor-react";
              }
              return "vendor";
            }
          },
        },
      },
    },
    server: {
      watch: {
        ignored: ["**/dist/**"],
      },
      ...(Object.keys(proxy).length ? { proxy } : {}),
    },
  };
});
 