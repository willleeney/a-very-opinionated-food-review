import '@testing-library/jest-dom'

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    origin: 'http://localhost:4321',
    pathname: '/',
  },
  writable: true,
})
