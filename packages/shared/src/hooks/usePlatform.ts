let _isNative = false
let _platform = 'web'

export function setPlatformInfo(isNative: boolean, platform: string) {
  _isNative = isNative
  _platform = platform
}

export function usePlatform() {
  return { isNative: _isNative, platform: _platform }
}
