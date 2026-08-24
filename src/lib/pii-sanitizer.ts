export interface SanitizedPayload {
  sanitizedText: string;
  tokenMap: Record<string, string>;
  rehydrate: (text: string) => string;
}

/**
 * Módulo de Sanitización de Privacidad (PII Scrubbing)
 * Reemplaza datos sensibles por máscaras anónimas antes de enviar el prompt a la nube.
 */
export function sanitizeText(text: string, knownEntities?: { names?: string[]; addresses?: string[] }): SanitizedPayload {
  const tokenMap: Record<string, string> = {};
  let currentDniIndex = 1;
  let currentPersonIndex = 1;
  let currentAddressIndex = 1;
  let currentPhoneIndex = 1;
  let sanitized = text;

  // 1. Anonimizar DNI (7 a 8 dígitos)
  const dniRegex = /\b\d{7,8}\b/g;
  sanitized = sanitized.replace(dniRegex, (match) => {
    // Evitar reemplazar números que parezcan códigos cortos
    const token = `[DNI_${currentDniIndex++}]`;
    tokenMap[token] = match;
    return token;
  });

  // 2. Anonimizar CUIT / CUIL (xx-xxxxxxxx-x)
  const cuitRegex = /\b\d{2}-\d{7,8}-\d\b/g;
  sanitized = sanitized.replace(cuitRegex, (match) => {
    const token = `[CUIT_${currentDniIndex++}]`;
    tokenMap[token] = match;
    return token;
  });

  // 3. Anonimizar Nombres y Apellidos conocidos de la base de datos
  if (knownEntities?.names && knownEntities.names.length > 0) {
    // Ordenar de mayor a menor longitud para no reemplazar subcadenas parciales
    const sortedNames = [...knownEntities.names].sort((a, b) => b.length - a.length);
    sortedNames.forEach((name) => {
      if (name && name.trim().length > 2) {
        const regex = new RegExp(escapeRegExp(name.trim()), "gi");
        if (regex.test(sanitized)) {
          const token = `[CIUDADANO_${currentPersonIndex++}]`;
          tokenMap[token] = name.trim();
          sanitized = sanitized.replace(regex, token);
        }
      }
    });
  }

  // 4. Anonimizar Direcciones conocidas de la base de datos
  if (knownEntities?.addresses && knownEntities.addresses.length > 0) {
    const sortedAddresses = [...knownEntities.addresses].sort((a, b) => b.length - a.length);
    sortedAddresses.forEach((addr) => {
      if (addr && addr.trim().length > 4) {
        const regex = new RegExp(escapeRegExp(addr.trim()), "gi");
        if (regex.test(sanitized)) {
          const token = `[DIRECCION_${currentAddressIndex++}]`;
          tokenMap[token] = addr.trim();
          sanitized = sanitized.replace(regex, token);
        }
      }
    });
  }

  // 5. Anonimizar Teléfonos (Formatos comunes)
  const phoneRegex = /(?:\+?54\s?)?(?:9\s?)?(?:\d{2,4})[\s-]?\d{6,8}/g;
  sanitized = sanitized.replace(phoneRegex, (match) => {
    if (match.length >= 8) {
      const token = `[TELEFONO_${currentPhoneIndex++}]`;
      tokenMap[token] = match;
      return token;
    }
    return match;
  });

  // Método para rehidratar la respuesta de la nube con los datos reales
  const rehydrate = (responseContent: string): string => {
    let restored = responseContent;
    Object.entries(tokenMap).forEach(([token, originalValue]) => {
      // Reemplazo global del token por el valor real original
      const tokenRegex = new RegExp(escapeRegExp(token), "g");
      restored = restored.replace(tokenRegex, originalValue);
    });
    return restored;
  };

  return {
    sanitizedText: sanitized,
    tokenMap,
    rehydrate
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
