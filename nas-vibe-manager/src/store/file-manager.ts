import { create } from "zustand"

export type ViewMode = "grid" | "list"

export interface FileItem {
  id: string
  name: string
  type: "file" | "folder"
  size: number
  modifiedAt: string
  extension?: string
  thumbnail?: string
}

export interface FileManagerState {
  // Current path
  currentPath: string
  pathHistory: string[]
  
  // View settings
  viewMode: ViewMode
  
  // Selection
  selectedFiles: Set<string>
  
  // Files
  files: FileItem[]
  isLoading: boolean
  
  // Actions
  setCurrentPath: (path: string) => void
  navigateBack: () => void
  navigateForward: () => void
  setViewMode: (mode: ViewMode) => void
  selectFile: (id: string, multi?: boolean) => void
  clearSelection: () => void
  setFiles: (files: FileItem[]) => void
  setLoading: (loading: boolean) => void
}

export const useFileManager = create<FileManagerState>((set, get) => ({
  // Initial state
  currentPath: "/",
  pathHistory: [],
  viewMode: "grid",
  selectedFiles: new Set(),
  files: [],
  isLoading: false,

  // Actions
  setCurrentPath: (path) => {
    const { currentPath, pathHistory } = get()
    set({
      currentPath: path,
      pathHistory: [...pathHistory, currentPath],
      selectedFiles: new Set(),
    })
  },

  navigateBack: () => {
    const { pathHistory } = get()
    if (pathHistory.length > 0) {
      const newHistory = [...pathHistory]
      const previousPath = newHistory.pop()
      set({
        currentPath: previousPath,
        pathHistory: newHistory,
        selectedFiles: new Set(),
      })
    }
  },

  navigateForward: () => {
    // TODO: Implement forward navigation
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  selectFile: (id, multi = false) => {
    const { selectedFiles } = get()
    const newSelection = new Set(multi ? selectedFiles : [])
    
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    
    set({ selectedFiles: newSelection })
  },

  clearSelection: () => set({ selectedFiles: new Set() }),

  setFiles: (files) => set({ files }),

  setLoading: (loading) => set({ isLoading: loading }),
}))

// Storage info store
export interface StorageInfo {
  total: number
  used: number
  free: number
}

interface StorageState {
  storage: StorageInfo
  setStorage: (storage: StorageInfo) => void
}

export const useStorage = create<StorageState>((set) => ({
  storage: {
    total: 16 * 1024 * 1024 * 1024 * 1024, // 16TB
    used: 8.5 * 1024 * 1024 * 1024 * 1024,  // 8.5TB
    free: 7.5 * 1024 * 1024 * 1024 * 1024,  // 7.5TB
  },
  setStorage: (storage) => set({ storage }),
}))
