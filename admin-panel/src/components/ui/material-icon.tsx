import React from "react";
import { cn } from "@/lib/utils";

interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number | string;
  fill?: boolean;
  weight?: number;
  grade?: number;
  opticalSize?: number;
}

/**
 * Material Symbols Outlined Icon (Native 9Router Icon Component)
 * Usage: <MaterialIcon name="dashboard" size={18} />
 */
export function MaterialIcon({
  name,
  size = 20,
  fill = false,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  className,
  style,
  ...props
}: MaterialIconProps) {
  const customStyle: React.CSSProperties = {
    fontSize: typeof size === "number" ? `${size}px` : size,
    fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
    ...style,
  };

  return (
    <span
      className={cn("material-symbols-outlined select-none inline-flex items-center justify-center shrink-0", className)}
      style={customStyle}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
}
