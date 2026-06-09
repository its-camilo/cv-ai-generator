export function sanitizeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return '/dashboard';
  }

  return url;
}
