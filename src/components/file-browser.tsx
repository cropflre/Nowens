"use client";

import { useEffect, useState } from "react";
import { useFileStore } from "@/lib/store";
import { FileCard } from "./file-card";
import { getFiles } from "@/app/actions"; 
import { FileObj } from "@/lib/mock-data"; 
import { FolderOpen, Loader2 } from "lucide-react";
import { MediaViewer } from "./media-viewer";

export function FileBrowser() {
  const { currentPath, navigateTo } = useFileStore();
  const [files, setFiles] = useState<FileObj[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 播放器状态
  const [previewFile, setPreviewFile] = useState<FileObj | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // 计算当前请求的相对路径
  // 例如：currentPath = [{name: 'Home'}, {name: 'Movies'}] -> "Movies"
  const currentRelativePath = currentPath
    .slice(1) // 去掉 'Home'
    .map(p => p.name)
    .join("/");

  // 当路径变化时，重新获取数据
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getFiles(currentRelativePath);
      setFiles(data);
      setLoading(false);
    }
    loadData();
  }, [currentRelativePath]); // 依赖项：路径变化就触发

  const handleFileClick = (file: FileObj) => {
    if (file.type === "folder") {
      navigateTo(file.id, file.name);
    } else if (['image', 'video', 'audio'].includes(file.type)) {
      // 如果是媒体文件，不导航，而是预览
      setPreviewFile(file);
      setIsViewerOpen(true);
    } else {
      console.log("Downloading/Opening file:", file.name);
      // 可以添加下载逻辑
      // window.open(`/api/file?path=${encodeURIComponent(file.id)}`, '_blank');
    }
  };

  // 1. Loading 状态
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground animate-pulse">
        <Loader2 className="h-10 w-10 animate-spin mb-2" />
        <p>Scanning drive...</p>
      </div>
    );
  }

  // 2. 空文件夹状态
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FolderOpen className="h-16 w-16 mb-4 opacity-20" />
        <p>This folder is empty.</p>
      </div>
    );
  }

  // 3. 正常显示
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 pb-20">
        {files.map((file) => (
          <div key={file.id} onClick={() => handleFileClick(file)}>
             <FileCard file={file} />
          </div>
        ))}
      </div>

      {/* 媒体播放器组件挂载在这里 */}
      <MediaViewer 
        file={previewFile} 
        isOpen={isViewerOpen} 
        onClose={() => setIsViewerOpen(false)} 
      />
    </>
  );
}
