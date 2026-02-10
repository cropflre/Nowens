import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import mime from "mime";

// 必须和 server action 里的根目录保持一致
const NAS_ROOT = process.env.NAS_ROOT || process.cwd();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get("path");

  if (!filePath) {
    return new NextResponse("Path is required", { status: 400 });
  }

  // 1. 构建绝对路径 (安全检查：防止访问 NAS_ROOT 以外的文件)
  const absolutePath = path.join(NAS_ROOT, filePath);
  
  // 规范化路径进行安全检查
  const normalizedAbsPath = path.normalize(absolutePath);
  const normalizedRoot = path.normalize(NAS_ROOT);
  
  // 简单防跨目录攻击
  if (!normalizedAbsPath.startsWith(normalizedRoot)) {
    return new NextResponse("Access denied", { status: 403 });
  }

  if (!fs.existsSync(absolutePath)) {
    return new NextResponse("File not found", { status: 404 });
  }

  // 2. 获取文件信息
  const stat = fs.statSync(absolutePath);
  const fileSize = stat.size;
  const contentType = mime.getType(absolutePath) || "application/octet-stream";

  // 3. 处理视频流 (Range Request) - 关键！让视频可以拖动进度条
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(absolutePath, { start, end });
    
    // 将 ReadStream 转换为 Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        file.on('data', (chunk) => controller.enqueue(chunk));
        file.on('end', () => controller.close());
        file.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": contentType,
      },
    });
  } else {
    // 4. 普通文件 (图片/下载)
    const file = fs.createReadStream(absolutePath);
    
    const webStream = new ReadableStream({
      start(controller) {
        file.on('data', (chunk) => controller.enqueue(chunk));
        file.on('end', () => controller.close());
        file.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
      },
    });
  }
}
