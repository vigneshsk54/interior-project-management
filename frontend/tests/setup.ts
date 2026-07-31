import '@testing-library/jest-dom/vitest'

const store = new Map<string, string>()
const storage: Storage = {
  get length() { return store.size },
  clear: () => store.clear(),
  getItem: (key) => store.get(key) ?? null,
  key: (index) => [...store.keys()][index] ?? null,
  removeItem: (key) => { store.delete(key) },
  setItem: (key, value) => { store.set(key, value) },
}
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
