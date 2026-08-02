import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
/**
 * Security Headers Middleware Plugin
 */
var securityHeaders = function (isDev) {
    // ✅ Production CSP - all resources loaded from 'self' plus necessary CDNs
    var getProductionCSP = function () {
        return [
            "default-src 'self'",
            // ✅ Allow Firebase, Google APIs, Cloudinary, and reCAPTCHA
            "script-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.cloudinary.com https://www.google.com https://www.gstatic.com",
            "worker-src 'self' blob:",
            // ✅ style-src only needs 'self' and 'unsafe-inline' (fonts loaded locally)
            "style-src 'self' 'unsafe-inline'",
            "style-src-elem 'self' 'unsafe-inline'",
            // ✅ Allow images from Cloudinary, Firebase, Google, and reCAPTCHA
            "img-src 'self' data: blob: https://*.googleapis.com https://*.firebaseio.com https://*.cloudinary.com https://www.google.com",
            // ✅ font-src only needs 'self' and data: (fonts loaded locally)
            "font-src 'self' data:",
            // ✅ Allow connections to Firebase, Cloudinary, Google APIs, and reCAPTCHA
            "connect-src 'self' https://api.cloudinary.com https://*.cloudinary.com https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://www.google.com",
            // ✅ Allow reCAPTCHA frames
            "frame-src 'none' https://www.google.com",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ].join("; ");
    };
    return {
        name: "security-headers",
        configureServer: function (server) {
            server.middlewares.use(function (req, res, next) {
                // Set basic security headers
                res.setHeader("X-Content-Type-Options", "nosniff");
                res.setHeader("X-Frame-Options", "DENY");
                res.setHeader("X-XSS-Protection", "1; mode=block");
                res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
                if (isDev) {
                    // ✅ Development: Permissive CSP that allows everything including reCAPTCHA
                    res.setHeader("Content-Security-Policy", [
                        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
                        "script-src * 'unsafe-inline' 'unsafe-eval' data: blob: https://www.google.com https://www.gstatic.com",
                        "style-src * 'unsafe-inline' data: blob:",
                        "img-src * data: blob: https://www.google.com",
                        "font-src * data: blob:",
                        "connect-src * data: blob: https://www.google.com",
                        "worker-src * data: blob:",
                        "media-src * data: blob:",
                        "frame-src * https://www.google.com",
                    ].join("; "));
                    console.log("🔓 [Security] Permissive CSP enabled in development mode");
                }
                else {
                    // ✅ Production: Strict CSP with self-hosted resources and reCAPTCHA allowed
                    res.setHeader("Content-Security-Policy", getProductionCSP());
                    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=()");
                    res.setHeader("Strict-Transport-Security", "max-age=2592000; includeSubDomains");
                    console.log("🔒 [Security] Strict CSP enabled in production mode");
                }
                next();
            });
        },
    };
};
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var isDev = mode === "development";
    return {
        plugins: [react(), tailwindcss(), securityHeaders(isDev)],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        optimizeDeps: {
            include: ["react", "react-dom"],
        },
        build: {
            target: "esnext",
            sourcemap: false,
            chunkSizeWarningLimit: 800,
            minify: "terser",
            terserOptions: {
                compress: {
                    drop_console: !isDev,
                    drop_debugger: !isDev,
                },
            },
            rollupOptions: {
                output: {
                    manualChunks: function (id) {
                        if (!id.includes("node_modules"))
                            return undefined;
                        if (id.includes("firebase/auth"))
                            return "firebase-auth";
                        if (id.includes("firebase/firestore"))
                            return "firebase-firestore";
                        if (id.includes("firebase/storage"))
                            return "firebase-storage";
                        if (id.includes("firebase/app"))
                            return "firebase-app";
                        if (id.includes("chart.js") || id.includes("react-chartjs-2")) {
                            return "charts-vendor";
                        }
                        if (id.includes("react-router-dom") || id.includes("react-redux")) {
                            return "app-vendor";
                        }
                        if (id.includes("react-dom")) {
                            return "react-dom-vendor";
                        }
                        if (id.includes("react")) {
                            return "react-vendor";
                        }
                        if (id.includes("react-icons")) {
                            return "icons-vendor";
                        }
                        if (id.includes("browser-image-compression")) {
                            return "image-vendor";
                        }
                        if (id.includes("yup") || id.includes("@hookform")) {
                            return "form-vendor";
                        }
                        if (id.includes("dompurify")) {
                            return "security-vendor";
                        }
                        if (id.includes("@fontsource") || id.includes("@fortawesome")) {
                            return "fonts-vendor";
                        }
                        return undefined;
                    },
                },
            },
        },
        server: {
            port: 5173,
            strictPort: false,
        },
    };
});
