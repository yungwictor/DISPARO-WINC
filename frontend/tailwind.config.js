export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      colors: {
        void: "#020604",
        graphite: "#07110d",
        panel: "#0b1712",
        line: "rgba(39,255,136,0.16)",
        neon: "#27ff88",
        mint: "#b9ffd6",
        acid: "#d8ff3e",
        danger: "#ff4d6d",
        amber: "#ffcc66"
      },
      boxShadow: {
        neon: "0 0 28px rgba(39,255,136,0.32)",
        panel: "0 24px 90px rgba(0,0,0,0.46)"
      }
    }
  },
  plugins: []
};
