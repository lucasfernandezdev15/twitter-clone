const TOKEN_COOKIE = "token";
const MAX_AGE = 7 * 24 * 60 * 60;

export function setTokenCookie(token: string) {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clearTokenCookie() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
