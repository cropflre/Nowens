"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FileObj, getFileIcon } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";
import { filesize } from "filesize";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileCardProps {
  file: FileObj;
}

export function FileCard({ file }: FileCardProps) {
  // 构建流媒体 URL
  const fileUrl = `/api/file?path=${encodeURIComponent(file.id)}`;

  return (
    <Card className="group relative cursor-pointer overflow-hidden border-transparent bg-muted/30 transition-all hover:bg-muted/50 hover:shadow-md hover:border-border/50 h-full flex flex-col">
      <CardContent className="flex-1 flex items-center justify-center p-0 relative min-h-[160px]">
        <div className="transform transition-transform group-hover:scale-105 duration-300 w-full h-full flex items-center justify-center">
            {file.type === 'image' ? (
                // 图片预览模式：使用 object-cover 填满卡片
                <div className="w-full h-full relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={fileUrl} 
                    alt={file.name} 
                    className="w-full h-full object-cover rounded-t-lg" 
                    loading="lazy"
                  />
                </div>
            ) : file.type === 'video' ? (
                // 视频文件：显示图标 + 播放按钮样式
                <div className="relative p-6 flex items-center justify-center">
                    {getFileIcon(file.type, "w-16 h-16")}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                </div>
            ) : (
                // 默认图标模式
                <div className="p-6">
                    {getFileIcon(file.type, "w-16 h-16")}
                </div>
            )}
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col items-start p-3 bg-background/60 backdrop-blur-sm border-t border-border/10">
        <div className="flex w-full items-start justify-between gap-2">
          <p className="truncate text-sm font-medium leading-none text-foreground/90 w-full" title={file.name}>
            {file.name}
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-1 shrink-0">
             <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="mt-2 flex w-full items-center justify-between text-[10px] text-muted-foreground">
          <span>{file.size ? filesize(file.size as number) : "--"}</span>
          <span>{file.updatedAt ? formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true }) : ''}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
