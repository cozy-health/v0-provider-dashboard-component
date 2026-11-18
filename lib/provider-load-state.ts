export type ProviderLoadState<T> = {
  path: string
  data?: T
  error?: string
  loading: boolean
  refreshing: boolean
}

export function visibleLoadState<T>(state: ProviderLoadState<T>, path: string): ProviderLoadState<T> {
  return state.path === path ? state : { path, loading: true, refreshing: false }
}

export function refreshingLoadState<T>(state: ProviderLoadState<T>, path: string): ProviderLoadState<T> {
  return state.path === path && state.data !== undefined
    ? { ...state, error: undefined, loading: false, refreshing: true }
    : { path, loading: true, refreshing: false }
}
