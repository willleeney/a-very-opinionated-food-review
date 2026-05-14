let _navigate: (path: string) => void = (path) => {
  window.location.href = path
}

let _getOrigin: () => string = () => window.location.origin

export function setNavigate(fn: (path: string) => void) {
  _navigate = fn
}

export function setGetOrigin(fn: () => string) {
  _getOrigin = fn
}

export function navigate(path: string) {
  _navigate(path)
}

export function getOrigin(): string {
  return _getOrigin()
}
