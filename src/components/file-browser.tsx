"use client";

import { useEffect, useState } from "react";
import { useFileStore } from "@/lib/store";
import { FileCard } from "./file-card";
import { FileListItem } from "./file-list-item";
import { getFiles } from "@/app/actions"; 
import { FileObj } from "@/lib/mock-data"; 
import { FolderOpen, Loader2, Grid3X3, List } from "lucide-react";
import { MediaViewer } from "./media-viewer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FileBrowser() {
  const { currentPath, navigateTo, viewMode, toggleViewMode } = useFileStore();
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
        <p>正在扫描...</p>
      </div>
    );
  }

  // 2. 空文件夹状态
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FolderOpen className="h-16 w-16 mb-4 opacity-20" />
        <p>文件夹为空</p>
      </div>
    );
  }

  // 3. 正常显示
  return (
    <>
      {/* 视图切换工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          共 {files.length} 个项目
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => viewMode !== "grid" && toggleViewMode()}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>网格视图</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => viewMode !== "list" && toggleViewMode()}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>列表视图</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 文件列表 - 根据视图模式显示 */}
      {viewMode === "grid" ? (
        // 网格视图
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 pb-20">
          {files.map((file) => (
            <div key={file.id} onClick={() => handleFileClick(file)}>
              <FileCard file={file} />
            </div>
          ))}
        </div>
      ) : (
        // 列表视图
        <div className="rounded-lg border border-border bg-card/50 overflow-hidden pb-20">
          {/* 列表头部 */}
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="w-10"></div>
            <div className="flex-1">名称</div>
            <div className="hidden sm:block w-24 text-right">大小</div>
            <div className="hidden md:block w-36 text-right">修改时间</div>
            <div className="w-8"></div>
          </div>
          {/* 文件列表 */}
          {files.map((file) => (
            <div key={file.id} onClick={() => handleFileClick(file)}>
              <FileListItem file={file} />
            </div>
          ))}
        </div>
      )}

      {/* 媒体播放器组件挂载在这里 */}
      <MediaViewer 
        file={previewFile} 
        isOpen={isViewerOpen} 
        onClose={() => setIsViewerOpen(false)} 
      />
    </>
  );
}
