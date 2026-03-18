import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function abbreviateRazaoSocial(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/condominio( do)? edificio/gi, "Cond. Ed.");
}
