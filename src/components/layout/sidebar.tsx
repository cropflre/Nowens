"use client"

import { 
  HardDrive, 
  Cloud, 
  Star, 
  Download, 
  Film, 
  Music, 
  Image, 
  FileText,
  Settings,
  ChevronDown,
  Copy,
  Trash2
} from "lucide-react"
import { cn, formatFileSize } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useFileManager, useStorage } from "@/store/file-manager"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavItem {
  icon: React.ElementType
  label: string
  path: string
  color?: string
  isLink?: boolean
}

const mainNavItems: NavItem[] = [
  { icon: Cloud, label: "My Cloud", path: "/", color: "text-blue-400", isLink: true },
  { icon: HardDrive, label: "所有文件", path: "/files" },
]

const toolItems: NavItem[] = [
  { icon: Copy, label: "重复文件清理", path: "/deduplicate", color: "text-orange-400", isLink: true },
]

const favoriteItems: NavItem[] = [
  { icon: Star, label: "收藏夹", path: "/favorites", color: "text-yellow-400" },
  { icon: Download, label: "下载", path: "/downloads", color: "text-green-400" },
  { icon: Film, label: "电影", path: "/movies", color: "text-purple-400" },
  { icon: Music, label: "音乐", path: "/music", color: "text-pink-400" },
  { icon: Image, label: "图片", path: "/photos", color: "text-cyan-400" },
  { icon: FileText, label: "文档", path: "/documents", color: "text-orange-400" },
]

export function Sidebar() {
  const { currentPath, setCurrentPath } = useFileManager()
  const { storage } = useStorage()
  const pathname = usePathname()
  
  const usedPercentage = (storage.used / storage.total) * 100

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar-background">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">NAS Vibe</h1>
            <p className="text-xs text-muted-foreground">File Manager</p>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          {/* Main Nav */}
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavButton
                key={item.path}
                item={item}
                isActive={item.isLink ? pathname === item.path : currentPath === item.path}
                onClick={() => !item.isLink && setCurrentPath(item.path)}
              />
            ))}
          </div>

          <Separator className="my-4" />

          {/* Tools */}
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              工具
            </span>
          </div>
          <div className="space-y-1">
            {toolItems.map((item) => (
              <NavButton
                key={item.path}
                item={item}
                isActive={pathname === item.path}
                onClick={() => {}}
              />
            ))}
          </div>

          <Separator className="my-4" />

          {/* Favorites */}
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              快捷访问
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            {favoriteItems.map((item) => (
              <NavButton
                key={item.path}
                item={item}
                isActive={currentPath === item.path}
                onClick={() => setCurrentPath(item.path)}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Storage Info */}
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">存储空间</span>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={usedPercentage} className="mb-2 h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatFileSize(storage.used)} 已用</span>
            <span>{formatFileSize(storage.total)} 总计</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

interface NavButtonProps {
  item: NavItem
  isActive: boolean
  onClick: () => void
}

function NavButton({ item, isActive, onClick }: NavButtonProps) {
  const Icon = item.icon
  
  const buttonContent = (
    <span
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5", item.color)} />
      <span>{item.label}</span>
    </span>
  )
  
  if (item.isLink) {
    return (
      <Link href={item.path}>
        {buttonContent}
      </Link>
    )
  }
  
  return (
    <button onClick={onClick} className="w-full">
      {buttonContent}
    </button>
  )
}
