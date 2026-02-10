"use client"

import { 
  Search, 
  Grid3X3, 
  List, 
  Upload, 
  FolderPlus, 
  RefreshCw,
  ChevronRight,
  Home,
  MoreHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFileManager } from "@/store/file-manager"
import { cn } from "@/lib/utils"

export function Header() {
  const { currentPath, viewMode, setViewMode, navigateBack } = useFileManager()

  // Parse breadcrumb from path
  const pathParts = currentPath.split("/").filter(Boolean)
  const breadcrumbs = [
    { label: "Home", path: "/" },
    ...pathParts.map((part, index) => ({
      label: part,
      path: "/" + pathParts.slice(0, index + 1).join("/"),
    })),
  ]

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={navigateBack}
                disabled={currentPath === "/"}
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>返回</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <nav className="flex items-center gap-1">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="mx-1 h-4 w-4 text-muted-foreground" />
              )}
              <button
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent",
                  index === breadcrumbs.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {index === 0 && <Home className="h-4 w-4" />}
                <span>{crumb.label}</span>
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* Center: Search */}
      <div className="flex max-w-md flex-1 items-center justify-center px-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索文件和文件夹..."
            className="h-9 w-full bg-muted/50 pl-10 focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border p-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewMode("grid")}
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
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>列表视图</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Refresh */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>刷新</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* New Folder */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>新建文件夹</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Upload Button */}
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          <span>上传</span>
        </Button>

        {/* More Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <span>排序方式</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>显示隐藏文件</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <span>设置</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
