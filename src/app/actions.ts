"use server"; // 👈 这一行至关重要，标记这是服务端代码

import fs from "node:fs/promises";
import path from "node:path";
import { FileObj, FileType } from "@/lib/mock-data";

// 设置你的 NAS 根目录
// 在本地开发时，暂时用当前项目目录，或者你可以改成 "D:/Movies" 这种绝对路径来测试
const NAS_ROOT = process.env.NAS_ROOT || process.cwd();

export async function getFiles(relativePath: string = ""): Promise<FileObj[]> {
  try {
    // 1. 构建绝对路径 (安全起见，防止目录遍历攻击，这里只做简单拼接)
    const targetPath = path.join(NAS_ROOT, relativePath);
    
    // 2. 读取目录
    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    // 3. 转换数据格式
    const files = await Promise.all(
      entries.map(async (entry) => {
        try {
          const stats = await fs.stat(path.join(targetPath, entry.name));
          const type = getFileType(entry, entry.name);
          
          return {
            id: relativePath ? path.join(relativePath, entry.name).replace(/\\/g, '/') : entry.name, // 用相对路径作为 ID，统一用 /
            parentId: relativePath || null,
            name: entry.name,
            type: type,
            size: stats.size,
            updatedAt: stats.mtime,
          };
        } catch (err) {
          // 某些文件可能没有权限访问，跳过
          return null;
        }
      })
    );

    // 过滤掉无法访问的文件
    const validFiles = files.filter((f): f is FileObj => f !== null);

    // 4. 排序：文件夹在前，然后按名称排序
    return validFiles.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });

  } catch (error) {
    console.error("Error reading directory:", error);
    return [];
  }
}

// 辅助函数：根据后缀名判断类型
function getFileType(entry: { isDirectory(): boolean }, name: string): FileType {
  if (entry.isDirectory()) return "folder";
  const ext = path.extname(name).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico"].includes(ext)) return "image";
  if ([".mp4", ".mkv", ".mov", ".avi", ".wmv", ".flv", ".webm", ".m4v"].includes(ext)) return "video";
  if ([".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"].includes(ext)) return "audio";
  if ([".pdf", ".txt", ".md", ".json", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv"].includes(ext)) return "document";
  return "unknown";
}
