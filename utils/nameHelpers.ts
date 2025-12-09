export function getInitials(name: string): string {
  if (!name || name.trim() === '') return '';
  
  const parts = name
    .trim()
    .split(/[\s-]+/)
    .filter(part => part.length > 0);
  
  if (parts.length === 0) return '';
  
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return parts
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 3);
}
