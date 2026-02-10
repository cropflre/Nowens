"use server"; // 👈 这一行至关重要，标记这是服务端代码

import fs from "node:fs/promises";
import path from "node:path";
import { FileObj, FileType } from "@/lib/mock-data";
import { 
  startFullScan, 
  findDuplicates, 
  getDuplicateGroups as getDupes, 
  deleteFile as removeFile,
  getScanStats as getStats,
  getScanProgress as getProgress,
  type DuplicateGroup 
} from "@/lib/scanner";
import { revalidatePath } from "next/cache";

// 设置你的 NAS 根目录
const NAS_ROOT = process.env.NAS_ROOT || process.cwd();

// ========== 文件浏览相关 ==========

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
            id: relativePath ? path.join(relativePath, entry.name).replace(/\\/g, '/') : entry.name,
            parentId: relativePath || null,
            name: entry.name,
            type: type,
            size: stats.size,
            updatedAt: stats.mtime,
          };
        } catch {
          return null;
        }
      })
    );

    // 过滤掉无法访问的文件
    const validFiles = files.filter((f): f is NonNullable<typeof f> => f !== null) as FileObj[];

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

// ========== 去重功能相关 ==========

// 1. 触发全盘扫描
export async function triggerScan(): Promise<{ success: boolean; count: number; error?: string }> {
  console.log("Starting scan...");
  try {
    const result = await startFullScan();
    revalidatePath("/deduplicate");
    return result;
  } catch (error) {
    console.error(error);
    return { success: false, count: 0, error: "Scan failed" };
  }
}

// 2. 触发去重计算（计算 Hash）
export async function analyzeDuplicates(): Promise<{ success: boolean; hashedCount: number }> {
  console.log("Analyzing duplicates...");
  try {
    const hashedCount = await findDuplicates();
    revalidatePath("/deduplicate");
    return { success: true, hashedCount };
  } catch (error) {
    console.error(error);
    return { success: false, hashedCount: 0 };
  }
}

// 3. 获取重复文件组详细信息
export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  return await getDupes();
}

// 4. 删除指定文件
export async function deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  const result = await removeFile(fileId);
  if (result.success) {
    revalidatePath("/deduplicate");
  }
  return result;
}

// 5. 批量删除文件
export async function deleteFiles(fileIds: string[]): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let deletedCount = 0;

  for (const id of fileIds) {
    const result = await removeFile(id);
    if (result.success) {
      deletedCount++;
    } else {
      errors.push(`${id}: ${result.error}`);
    }
  }

  revalidatePath("/deduplicate");
  return { success: errors.length === 0, deletedCount, errors };
}

// 6. 获取扫描统计信息
export async function getScanStats() {
  return await getStats();
}

// 7. 获取扫描进度
export async function getScanProgress() {
  return getProgress();
}
