module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#0b1220",
        neon: "#2ef2ff",
        ember: "#ff6b4a",
        warning: "#ffb020",
        safe: "#2bd576"
      },
      boxShadow: {
        glass: "0 0 40px rgba(46, 242, 255, 0.15)"
      },
      backdropBlur: {
        glass: "18px"
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 12px rgba(46, 242, 255, 0.25)" },
          "50%": { boxShadow: "0 0 24px rgba(46, 242, 255, 0.45)" }
        },
        scanLine: {
          "0%": { transform: "translateY(-20%)", opacity: 0 },
          "50%": { opacity: 0.35 },
          "100%": { transform: "translateY(120%)", opacity: 0 }
        }
      },
      animation: {
        pulseGlow: "pulseGlow 2.8s ease-in-out infinite",
        scanLine: "scanLine 3.6s linear infinite"
      }
    }
  },
  plugins: []
};
