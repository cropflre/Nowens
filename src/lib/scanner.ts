import fs from "node:fs/promises";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

// 硬编码数据库路径，确保稳定
const DB_PATH = "C:/AA/Nowens/dev.db";

// Prisma 7 需要使用 adapter - 每次创建新实例避免缓存问题
const createPrismaClient = () => {
  const libsql = createClient({
    url: `file:${DB_PATH}`,
  });
  const adapter = new PrismaLibSql(libsql);
  return new PrismaClient({ adapter });
};

// 在开发环境使用全局缓存避免连接过多
const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const NAS_ROOT = process.env.NAS_ROOT || process.cwd();

// 扫描状态
export interface ScanProgress {
  status: "idle" | "scanning" | "hashing" | "done" | "error";
  scannedFiles: number;
  totalFiles: number;
  currentFile?: string;
  message?: string;
}

let scanProgress: ScanProgress = {
  status: "idle",
  scannedFiles: 0,
  totalFiles: 0,
};

export function getScanProgress(): ScanProgress {
  return { ...scanProgress };
}

// 1. 计算文件 Hash (流式处理，内存占用低)
async function calculateHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5"); // MD5 速度快，冲突概率在 NAS 场景可忽略
    const stream = createReadStream(filePath);
    
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

// 2. 递归扫描并入库
export async function scanDirectory(relativePath: string = ""): Promise<number> {
  const fullPath = path.join(NAS_ROOT, relativePath);
  
  let entries;
  try {
    entries = await fs.readdir(fullPath, { withFileTypes: true });
  } catch (error) {
    console.error(`Cannot read directory: ${fullPath}`, error);
    return 0;
  }

  let count = 0;

  for (const entry of entries) {
    const entryRelativePath = path.join(relativePath, entry.name).replace(/\\/g, '/');
    const entryFullPath = path.join(NAS_ROOT, entryRelativePath);

    // 忽略隐藏文件和系统文件夹
    if (entry.name.startsWith(".") || 
        entry.name === "node_modules" || 
        entry.name === "$RECYCLE.BIN" ||
        entry.name === "System Volume Information") {
      continue;
    }

    if (entry.isDirectory()) {
      // 递归扫描
      count += await scanDirectory(entryRelativePath);
    } else if (entry.isFile()) {
      try {
        const stats = statSync(entryFullPath);
        
        // 更新进度
        scanProgress.scannedFiles++;
        scanProgress.currentFile = entry.name;
        
        // 关键逻辑：
        // 我们不立即计算 Hash，只存 Path 和 Size。
        // Hash 计算非常耗时，我们只对 Size 相同的文件计算 Hash（Lazy Load 策略）
        
        await prisma.fileRecord.upsert({
          where: { path: entryRelativePath },
          update: { 
            size: BigInt(stats.size),
            mtime: stats.mtime,
            scannedAt: new Date()
          },
          create: {
            path: entryRelativePath,
            name: entry.name,
            size: BigInt(stats.size),
            mtime: stats.mtime,
            hash: null, // 先留空，发现重复大小后再算
          },
        });
        count++;
      } catch (e) {
        console.error(`Skipping ${entry.name}:`, e);
      }
    }
  }
  return count;
}

// 3. 启动全盘扫描（带状态跟踪）
export async function startFullScan(): Promise<{ success: boolean; count: number; error?: string }> {
  if (scanProgress.status === "scanning" || scanProgress.status === "hashing") {
    return { success: false, count: 0, error: "Scan already in progress" };
  }

  scanProgress = {
    status: "scanning",
    scannedFiles: 0,
    totalFiles: 0,
    message: "正在扫描文件系统..."
  };

  try {
    const count = await scanDirectory("");
    scanProgress.status = "done";
    scanProgress.message = `扫描完成，共 ${count} 个文件`;
    return { success: true, count };
  } catch (error) {
    scanProgress.status = "error";
    scanProgress.message = "扫描出错";
    console.error("Scan error:", error);
    return { success: false, count: 0, error: String(error) };
  }
}

// 4. 核心：查找并计算重复项
export async function findDuplicates(): Promise<number> {
  scanProgress.status = "hashing";
  scanProgress.message = "正在分析重复文件...";

  // 第一步：找出所有 size 相同且出现次数 > 1 的记录
  const duplicatesBySize = await prisma.$queryRaw<Array<{ size: bigint; count: bigint }>>`
    SELECT size, COUNT(*) as count 
    FROM FileRecord 
    GROUP BY size 
    HAVING count > 1
  `;

  const potentialDupesCount = duplicatesBySize.length;
  console.log(`Found ${potentialDupesCount} groups of files with same size. Hashing them now...`);

  let hashedCount = 0;

  // 第二步：只对这些嫌疑犯计算 Hash
  for (const group of duplicatesBySize) {
    const files = await prisma.fileRecord.findMany({
      where: { size: group.size },
    });

    for (const file of files) {
      if (!file.hash) {
        const fullPath = path.join(NAS_ROOT, file.path);
        try {
          scanProgress.currentFile = file.name;
          const hash = await calculateHash(fullPath);
          await prisma.fileRecord.update({
            where: { id: file.id },
            data: { hash },
          });
          hashedCount++;
        } catch (err) {
          console.error(`Failed to hash ${file.path}:`, err);
        }
      }
    }
  }

  scanProgress.status = "done";
  scanProgress.message = `分析完成，已计算 ${hashedCount} 个文件的指纹`;
  
  return hashedCount;
}

// 5. 获取重复文件组（供前端展示）
export interface DuplicateGroup {
  hash: string;
  size: number;
  files: Array<{
    id: string;
    name: string;
    path: string;
    size: bigint;
    mtime: Date | null;
  }>;
  wastedSpace: number; // 可节省的空间
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  // 找出所有 hash 不为空且重复的记录
  const duplicateHashes = await prisma.$queryRaw<Array<{ hash: string; size: bigint; count: bigint }>>`
    SELECT hash, size, COUNT(*) as count 
    FROM FileRecord 
    WHERE hash IS NOT NULL 
    GROUP BY hash 
    HAVING count > 1
    ORDER BY (size * count) DESC
  `;

  const result: DuplicateGroup[] = [];

  for (const group of duplicateHashes) {
    const files = await prisma.fileRecord.findMany({
      where: { hash: group.hash },
      select: { id: true, name: true, path: true, size: true, mtime: true },
      orderBy: { mtime: 'desc' } // 最新的排前面
    });

    const sizeNum = Number(group.size);
    
    result.push({
      hash: group.hash,
      size: sizeNum,
      files: files,
      wastedSpace: sizeNum * (files.length - 1) // 可节省空间 = 单文件大小 * (重复数-1)
    });
  }

  return result;
}

// 6. 删除指定文件（安全删除）
export async function deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const record = await prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!record) {
      return { success: false, error: "文件记录不存在" };
    }

    const fullPath = path.join(NAS_ROOT, record.path);
    
    // 删除实际文件
    await fs.unlink(fullPath);
    
    // 删除数据库记录
    await prisma.fileRecord.delete({ where: { id: fileId } });
    
    return { success: true };
  } catch (error) {
    console.error("Delete error:", error);
    return { success: false, error: String(error) };
  }
}

// 7. 获取扫描统计信息
export async function getScanStats() {
  const totalFiles = await prisma.fileRecord.count();
  const hashedFiles = await prisma.fileRecord.count({ where: { hash: { not: null } } });
  const totalSize = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COALESCE(SUM(size), 0) as total FROM FileRecord
  `;
  
  // 计算重复文件浪费的空间
  const wastedSpace = await prisma.$queryRaw<Array<{ wasted: bigint }>>`
    SELECT COALESCE(SUM(size * (cnt - 1)), 0) as wasted FROM (
      SELECT hash, size, COUNT(*) as cnt 
      FROM FileRecord 
      WHERE hash IS NOT NULL 
      GROUP BY hash 
      HAVING cnt > 1
    )
  `;

  return {
    totalFiles,
    hashedFiles,
    totalSize: Number(totalSize[0]?.total || 0),
    wastedSpace: Number(wastedSpace[0]?.wasted || 0),
  };
}
