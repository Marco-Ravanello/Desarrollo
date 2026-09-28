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
            parsed.customLogoUrl !== "/logo-3f.jpg" &&
            parsed.customLogoUrl !== "/logo-3f.png"
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
        alt="Logo Municipal Oficial"
        className={`${className} object-contain`}
        onError={() => setCustomLogo(null)}
      />
    );
  }

  // Logo Oficial 3F fijo
  return (
    <img
      src="/logo-3f.png"
      alt="Logo Oficial 3F - Municipalidad de Tres de Febrero"
      className={`${className} object-contain rounded-xl select-none`}
    />
  );
}
