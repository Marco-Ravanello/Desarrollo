"use client";

import React, { useState, useEffect } from "react";

export function MunicipalCrest({
  className = "h-8 w-8",
  forceDefault = false
}: {
  className?: string;
  forceDefault?: boolean;
}) {
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    if (forceDefault) return;
    const loadLogo = () => {
      try {
        const saved = localStorage.getItem("muni-system-settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed.customLogoUrl &&
            typeof parsed.customLogoUrl === "string" &&
            parsed.customLogoUrl.trim() !== "" &&
            parsed.customLogoUrl !== "/logo-3f.jpg"
          ) {
            setCustomLogo(parsed.customLogoUrl);
            return;
          }
        }
        setCustomLogo(null);
      } catch (e) {
        setCustomLogo(null);
      }
    };
    loadLogo();
    window.addEventListener("muni-settings-updated", loadLogo);
    window.addEventListener("storage", loadLogo);
    return () => {
      window.removeEventListener("muni-settings-updated", loadLogo);
      window.removeEventListener("storage", loadLogo);
    };
  }, [forceDefault]);

  if (customLogo && !forceDefault) {
    return (
      <img
        src={customLogo}
        alt="Logo Municipal 3F"
        className={`${className} object-contain`}
        onError={() => setCustomLogo(null)}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo Municipal 3F - Tres de Febrero"
      role="img"
    >
      <defs>
        <linearGradient id="crestNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B4679" />
          <stop offset="50%" stopColor="#163C68" />
          <stop offset="100%" stopColor="#0E2A49" />
        </linearGradient>
        <linearGradient id="crestOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFA834" />
          <stop offset="100%" stopColor="#F69321" />
        </linearGradient>
      </defs>
      {/* Escudo / Emblema Municipal Redondeado */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="22"
        fill="url(#crestNavyGrad)"
        stroke="url(#crestOrangeGrad)"
        strokeWidth="3.5"
      />
      {/* Línea interior sutil */}
      <rect
        x="7.5"
        y="7.5"
        width="85"
        height="85"
        rx="18.5"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
        strokeWidth="0.8"
      />
      {/* Sol de Mayo Institucional */}
      <circle cx="50" cy="21" r="5" fill="url(#crestOrangeGrad)" />
      {/* Rayos del Sol */}
      <path
        d="M50 12 L50 14.5 M42.5 13.5 L44 15.5 M57.5 13.5 L56 15.5 M36.5 16.5 L38.5 18 M63.5 16.5 L61.5 18 M33 21 L35.5 21.5 M67 21 L64.5 21.5"
        stroke="#FFB834"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Monograma Oficial 3F */}
      <text
        x="37"
        y="58"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Montserrat, sans-serif"
        fontSize="36"
        fontWeight="900"
        letterSpacing="-1.5"
      >
        3
      </text>
      <text
        x="63"
        y="58"
        textAnchor="middle"
        dominantBaseline="central"
        fill="url(#crestOrangeGrad)"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Montserrat, sans-serif"
        fontSize="36"
        fontWeight="900"
        letterSpacing="-1.5"
      >
        F
      </text>
      {/* Línea divisoria con nodo central */}
      <path
        d="M24 72 L76 72"
        stroke="url(#crestOrangeGrad)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="50" cy="72" r="1.8" fill="#FFFFFF" />
      {/* Leyenda institucional */}
      <text
        x="50"
        y="80"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Montserrat, sans-serif"
        fontSize="5.6"
        fontWeight="800"
        letterSpacing="0.6"
      >
        TRES DE FEBRERO
      </text>
      <text
        x="50"
        y="87"
        textAnchor="middle"
        fill="#B8D0EB"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Montserrat, sans-serif"
        fontSize="4.2"
        fontWeight="700"
        letterSpacing="0.8"
      >
        MUNICIPALIDAD
      </text>
    </svg>
  );
}
