let _navigate: (path: string) => void = (path) => {
  window.location.href = path
}

let _getOrigin: () => string = () => window.location.origin

let _openExternal: ((url: string) => Promise<void>) | null = null

export function setNavigate(fn: (path: string) => void) {
  _navigate = fn
}

export function setGetOrigin(fn: () => string) {
  _getOrigin = fn
}

export function setOpenExternal(fn: (url: string) => Promise<void>) {
  _openExternal = fn
}

export function navigate(path: string) {
  _navigate(path)
}

export function getOrigin(): string {
  return _getOrigin()
}

export function openExternal(url: string): Promise<void> | null {
  return _openExternal ? _openExternal(url) : null
}

export function isNativePlatform(): boolean {
  return _openExternal !== null
}
