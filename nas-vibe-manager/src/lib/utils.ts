import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase()
}

export function getFileIcon(filename: string, isDirectory: boolean): string {
  if (isDirectory) return "folder"
  
  const ext = getFileExtension(filename)
  const iconMap: Record<string, string> = {
    // Images
    jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", svg: "image",
    // Videos
    mp4: "video", mkv: "video", avi: "video", mov: "video", wmv: "video",
    // Audio
    mp3: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio",
    // Documents
    pdf: "file-text", doc: "file-text", docx: "file-text", txt: "file-text",
    // Code
    js: "file-code", ts: "file-code", jsx: "file-code", tsx: "file-code",
    html: "file-code", css: "file-code", json: "file-code",
    // Archives
    zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  }
  
  return iconMap[ext] || "file"
}
