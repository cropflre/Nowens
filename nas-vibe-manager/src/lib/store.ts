import { create } from 'zustand';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface FileStore {
  // 状态
  currentPath: BreadcrumbItem[]; // 路径栈，例如 [{id: 'root', name: 'Home'}, {id: '1', name: 'Movies'}]
  viewMode: 'grid' | 'list';
  
  // 动作
  navigateTo: (folderId: string, folderName: string) => void;
  navigateUp: () => void;
  setPath: (path: BreadcrumbItem[]) => void;
  toggleViewMode: () => void;
}

export const useFileStore = create<FileStore>((set) => ({
  // 初始路径只有 Home (ID: null)
  currentPath: [{ id: 'root', name: 'Home' }], 
  viewMode: 'grid',

  navigateTo: (folderId, folderName) => 
    set((state) => ({ 
      currentPath: [...state.currentPath, { id: folderId, name: folderName }] 
    })),

  navigateUp: () => 
    set((state) => {
      if (state.currentPath.length <= 1) return state;
      return { currentPath: state.currentPath.slice(0, -1) };
    }),

  setPath: (path) => set({ currentPath: path }),
  
  toggleViewMode: () => 
    set((state) => ({ viewMode: state.viewMode === 'grid' ? 'list' : 'grid' })),
}));
