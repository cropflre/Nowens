"use client"

import { 
  Folder, 
  File, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  FileCode, 
  FileArchive,
  MoreVertical,
  Download,
  Pencil,
  Trash2,
  Copy,
  Move,
  Star
} from "lucide-react"
import { cn, formatFileSize, formatDate, getFileExtension } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFileManager, FileItem } from "@/store/file-manager"

// Mock data for demonstration
const mockFiles: FileItem[] = [
  { id: "1", name: "电影", type: "folder", size: 0, modifiedAt: "2024-12-15T10:30:00" },
  { id: "2", name: "音乐", type: "folder", size: 0, modifiedAt: "2024-12-14T08:00:00" },
  { id: "3", name: "图片", type: "folder", size: 0, modifiedAt: "2024-12-13T14:20:00" },
  { id: "4", name: "文档", type: "folder", size: 0, modifiedAt: "2024-12-12T09:15:00" },
  { id: "5", name: "下载", type: "folder", size: 0, modifiedAt: "2024-12-10T16:45:00" },
  { id: "6", name: "项目备份.zip", type: "file", size: 1024 * 1024 * 256, modifiedAt: "2024-12-09T11:30:00", extension: "zip" },
  { id: "7", name: "风景照片.jpg", type: "file", size: 1024 * 1024 * 8.5, modifiedAt: "2024-12-08T20:00:00", extension: "jpg", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200" },
  { id: "8", name: "会议记录.docx", type: "file", size: 1024 * 85, modifiedAt: "2024-12-07T15:30:00", extension: "docx" },
  { id: "9", name: "演示视频.mp4", type: "file", size: 1024 * 1024 * 1024 * 1.2, modifiedAt: "2024-12-06T12:00:00", extension: "mp4" },
  { id: "10", name: "背景音乐.mp3", type: "file", size: 1024 * 1024 * 12, modifiedAt: "2024-12-05T18:20:00", extension: "mp3" },
  { id: "11", name: "源代码.tsx", type: "file", size: 1024 * 24, modifiedAt: "2024-12-04T10:00:00", extension: "tsx" },
  { id: "12", name: "配置文件.json", type: "file", size: 1024 * 2, modifiedAt: "2024-12-03T09:00:00", extension: "json" },
]

export function FileExplorer() {
  const { viewMode, selectedFiles, selectFile, setCurrentPath } = useFileManager()

  const handleDoubleClick = (file: FileItem) => {
    if (file.type === "folder") {
      setCurrentPath(`/${file.name}`)
    }
  }

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="p-6">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {mockFiles.map((file) => (
              <FileGridItem
                key={file.id}
                file={file}
                isSelected={selectedFiles.has(file.id)}
                onSelect={(multi) => selectFile(file.id, multi)}
                onDoubleClick={() => handleDoubleClick(file)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            {/* List Header */}
            <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <div className="col-span-6">名称</div>
              <div className="col-span-2">大小</div>
              <div className="col-span-3">修改日期</div>
              <div className="col-span-1"></div>
            </div>
            {/* List Items */}
            <div className="divide-y divide-border">
              {mockFiles.map((file) => (
                <FileListItem
                  key={file.id}
                  file={file}
                  isSelected={selectedFiles.has(file.id)}
                  onSelect={(multi) => selectFile(file.id, multi)}
                  onDoubleClick={() => handleDoubleClick(file)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

interface FileItemProps {
  file: FileItem
  isSelected: boolean
  onSelect: (multi: boolean) => void
  onDoubleClick: () => void
}

function FileGridItem({ file, isSelected, onSelect, onDoubleClick }: FileItemProps) {
  const Icon = getFileIcon(file)

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "group relative flex cursor-pointer flex-col items-center rounded-xl border border-transparent p-4 transition-all",
            "hover:border-border hover:bg-accent/50",
            isSelected && "border-primary bg-primary/10"
          )}
          onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
          onDoubleClick={onDoubleClick}
        >
          {/* Thumbnail / Icon */}
          <div className="mb-3 flex h-20 w-20 items-center justify-center">
            {file.thumbnail ? (
              <img
                src={file.thumbnail}
                alt={file.name}
                className="h-full w-full rounded-lg object-cover"
              />
            ) : file.type === "folder" ? (
              <Folder className="h-16 w-16 text-blue-400" fill="currentColor" strokeWidth={1} />
            ) : (
              <Icon className="h-14 w-14 text-muted-foreground" />
            )}
          </div>

          {/* File Name */}
          <p className="w-full truncate text-center text-sm font-medium text-foreground">
            {file.name}
          </p>
          
          {/* File Size */}
          {file.type === "file" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          )}

          {/* Quick Actions (visible on hover) */}
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <FileActionsMenu />
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <FileContextMenu />
    </ContextMenu>
  )
}

function FileListItem({ file, isSelected, onSelect, onDoubleClick }: FileItemProps) {
  const Icon = getFileIcon(file)

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "grid cursor-pointer grid-cols-12 items-center gap-4 px-4 py-3 transition-colors",
            "hover:bg-accent/50",
            isSelected && "bg-primary/10"
          )}
          onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
          onDoubleClick={onDoubleClick}
        >
          {/* Name */}
          <div className="col-span-6 flex items-center gap-3">
            {file.type === "folder" ? (
              <Folder className="h-5 w-5 text-blue-400" fill="currentColor" strokeWidth={1} />
            ) : (
              <Icon className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
          </div>

          {/* Size */}
          <div className="col-span-2 text-sm text-muted-foreground">
            {file.type === "file" ? formatFileSize(file.size) : "--"}
          </div>

          {/* Modified Date */}
          <div className="col-span-3 text-sm text-muted-foreground">
            {formatDate(file.modifiedAt)}
          </div>

          {/* Actions */}
          <div className="col-span-1 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <FileActionsMenu />
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <FileContextMenu />
    </ContextMenu>
  )
}

function FileActionsMenu() {
  return (
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem>
        <Download className="mr-2 h-4 w-4" />
        <span>下载</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Star className="mr-2 h-4 w-4" />
        <span>添加到收藏</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <Pencil className="mr-2 h-4 w-4" />
        <span>重命名</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Copy className="mr-2 h-4 w-4" />
        <span>复制</span>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Move className="mr-2 h-4 w-4" />
        <span>移动</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive focus:text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        <span>删除</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

function FileContextMenu() {
  return (
    <ContextMenuContent className="w-56">
      <ContextMenuItem>
        <Download className="mr-2 h-4 w-4" />
        <span>下载</span>
        <ContextMenuShortcut>⌘D</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem>
        <Star className="mr-2 h-4 w-4" />
        <span>添加到收藏</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem>
        <Pencil className="mr-2 h-4 w-4" />
        <span>重命名</span>
        <ContextMenuShortcut>F2</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem>
        <Copy className="mr-2 h-4 w-4" />
        <span>复制</span>
        <ContextMenuShortcut>⌘C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem>
        <Move className="mr-2 h-4 w-4" />
        <span>移动到...</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem className="text-destructive focus:text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        <span>删除</span>
        <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

function getFileIcon(file: FileItem) {
  if (file.type === "folder") return Folder
  
  const ext = file.extension?.toLowerCase() || getFileExtension(file.name)
  
  const iconMap: Record<string, typeof File> = {
    // Images
    jpg: FileImage, jpeg: FileImage, png: FileImage, gif: FileImage, webp: FileImage, svg: FileImage,
    // Videos
    mp4: FileVideo, mkv: FileVideo, avi: FileVideo, mov: FileVideo, wmv: FileVideo,
    // Audio
    mp3: FileAudio, wav: FileAudio, flac: FileAudio, aac: FileAudio, ogg: FileAudio,
    // Documents
    pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText,
    // Code
    js: FileCode, ts: FileCode, jsx: FileCode, tsx: FileCode, html: FileCode, css: FileCode, json: FileCode,
    // Archives
    zip: FileArchive, rar: FileArchive, "7z": FileArchive, tar: FileArchive, gz: FileArchive,
  }
  
  return iconMap[ext] || File
}
