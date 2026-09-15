import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Tres de Febrero Official Brand Tokens
        muni: {
          blue: "#163C68",
          navy: "#0E2A49",
          softblue: "#B8D0EB",
          iceblue: "#E0EEFF",
          orange: "#F69321",
          darkorange: "#DB7A0B",
          softorange: "#F6BF80",
          peachy: "#F6E6D4",
          text: "#000D1D",
          body: "#2F4054",
          muted: "#B1B7BE",
          border: "#E5E5E5",
          surface: "#F8F8F8",
          canvas: "#FDFDFD",
        },
      },
      fontFamily: {
        heading: ["var(--font-montserrat)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 13, 29, 0.08)',
        'md': '0 4px 12px rgba(0, 13, 29, 0.1)',
        'lg': '0 8px 30px rgba(0, 13, 29, 0.12)',
        'xl': '0 16px 48px rgba(0, 13, 29, 0.14)',
        'municipal': '0 10px 30px -10px rgba(22, 60, 104, 0.08), 0 1px 3px rgba(22, 60, 104, 0.02)',
        'municipal-lg': '0 20px 40px -15px rgba(22, 60, 104, 0.12), 0 1px 4px rgba(22, 60, 104, 0.04)',
        'glass-light': '0 8px 32px 0 rgba(22, 60, 104, 0.05)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
export default config;
