import { create } from 'zustand'
import type { FileItem } from '@/types'
import { getFileList } from '@/api/file'

interface FileState {
  files: FileItem[]
  breadcrumb: FileItem[]
  currentParentId: number
  loading: boolean
  sortBy: string
  sortOrder: string
  viewMode: 'grid' | 'list'
  loadFiles: (parentId?: number) => Promise<void>
  toggleViewMode: () => void
  setViewMode: (mode: 'grid' | 'list') => void
  enterFolder: (folderId: number) => void
  goBack: () => void
  goHome: () => void
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  breadcrumb: [],
  currentParentId: 0,
  loading: false,
  sortBy: 'updated_at',
  sortOrder: 'desc',
  viewMode: (localStorage.getItem('viewMode') as 'grid' | 'list') || 'grid',

  loadFiles: async (parentId?: number) => {
    if (parentId !== undefined) {
      set({ currentParentId: parentId })
    }
    set({ loading: true })
    try {
      const state = get()
      const pid = parentId !== undefined ? parentId : state.currentParentId
      const res = await getFileList({
        parent_id: pid,
        sort: state.sortBy,
        order: state.sortOrder,
      })
      set({
        files: res.data!.files || [],
        breadcrumb: res.data!.breadcrumb || [],
      })
    } catch {
      // 错误已在拦截器处理
    } finally {
      set({ loading: false })
    }
  },

  toggleViewMode: () => {
    const newMode = get().viewMode === 'grid' ? 'list' : 'grid'
    set({ viewMode: newMode })
    localStorage.setItem('viewMode', newMode)
  },

  setViewMode: (mode: 'grid' | 'list') => {
    set({ viewMode: mode })
    localStorage.setItem('viewMode', mode)
  },

  enterFolder: (folderId: number) => {
    get().loadFiles(folderId)
  },

  goBack: () => {
    const { breadcrumb } = get()
    if (breadcrumb.length > 0) {
      const parent = breadcrumb[breadcrumb.length - 1]
      get().loadFiles(parent.parent_id)
    } else {
      get().loadFiles(0)
    }
  },

  goHome: () => {
    get().loadFiles(0)
  },
}))
