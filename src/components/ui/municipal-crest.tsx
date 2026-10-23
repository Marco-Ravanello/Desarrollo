"use client";

import React, { useState } from "react";
import { useMunicipalSettings } from "@/components/providers/municipal-settings";

export function MunicipalCrest({
  className = "h-8 w-8",
  forceDefault = false
}: {
  className?: string;
  forceDefault?: boolean;
}) {
  const { logoUrl } = useMunicipalSettings();
  const [failed, setFailed] = useState(false);
  const customLogo = !forceDefault && !failed ? logoUrl : null;

  if (customLogo && !forceDefault) {
    return (
      <img
        src={customLogo}
        alt="Logo Municipal Oficial"
        className={`${className} object-contain`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      src="/logo-3f.png"
      alt="Logo 3F - Municipalidad de Tres de Febrero"
      className={`${className} rounded-[22%] object-cover select-none shrink-0`}
      draggable={false}
    />
  );
}
