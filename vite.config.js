import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/build-a-full-stack-student-grade-tracker-react-frontend-with-a-clean-dark-theme-8c54d8/",
  build: { outDir: "dist", assetsDir: "assets" },
  server: { port: 3000 },
});
