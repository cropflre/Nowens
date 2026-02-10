"use client"

import { FileObj, getFileIcon } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";
import { filesize } from "filesize";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileListItemProps {
  file: FileObj;
}

export function FileListItem({ file }: FileListItemProps) {
  // 构建流媒体 URL
  const fileUrl = `/api/file?path=${encodeURIComponent(file.id)}`;

  // 获取文件扩展名
  const getExtension = (filename: string) => {
    const ext = filename.split('.').pop();
    return ext ? ext.toUpperCase() : '--';
  };

  return (
    <div className="group flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border-b border-border/30 last:border-b-0">
      {/* 图标/缩略图 */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
        {file.type === 'image' ? (
          <div className="w-10 h-10 rounded overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={fileUrl} 
              alt={file.name} 
              className="w-full h-full object-cover" 
              loading="lazy"
            />
          </div>
        ) : file.type === 'video' ? (
          <div className="relative">
            {getFileIcon(file.type, "w-8 h-8")}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <svg className="w-2 h-2 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        ) : (
          getFileIcon(file.type, "w-8 h-8")
        )}
      </div>

      {/* 文件名 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate" title={file.name}>
          {file.name}
        </p>
        {file.type !== 'folder' && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {getExtension(file.name)} 文件
          </p>
        )}
      </div>

      {/* 大小 */}
      <div className="hidden sm:block w-24 text-right">
        <span className="text-sm text-muted-foreground">
          {file.type === 'folder' ? '--' : (file.size ? filesize(file.size as number) : '--')}
        </span>
      </div>

      {/* 修改时间 */}
      <div className="hidden md:block w-36 text-right">
        <span className="text-sm text-muted-foreground">
          {file.updatedAt ? formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true }) : '--'}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="w-8">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
