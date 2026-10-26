import { cn } from "@/lib/utils";
import { initialsColor, initialsOf } from "@/lib/initials";

const SIZES = {
  xs: "h-5 w-5 text-[0.6rem]",
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-20 w-20 text-2xl",
} as const;

interface InitialsAvatarProps {
  /** Nombre entero ("Juan Pérez" o "Pérez, Juan") o solo el nombre si se pasa `lastName`. */
  name: string | null | undefined;
  lastName?: string | null;
  /** Dato fijo para el color (id del usuario o DNI). Si falta, se usa el nombre. */
  seed?: string | null;
  size?: keyof typeof SIZES;
  /** Cuadrado con puntas redondeadas en lugar de círculo. */
  square?: boolean;
  className?: string;
}

/** Círculo con las iniciales y un color fijo para cada persona. Es decorativo: el nombre va al lado. */
export function InitialsAvatar({ name, lastName, seed, size = "md", square = false, className }: InitialsAvatarProps) {
  const fullName = lastName !== undefined ? `${name ?? ""} ${lastName ?? ""}` : name;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-bold leading-none",
        square ? "rounded-xl" : "rounded-full",
        SIZES[size],
        initialsColor(seed || fullName),
        className
      )}
    >
      {initialsOf(name, lastName)}
    </span>
  );
}
