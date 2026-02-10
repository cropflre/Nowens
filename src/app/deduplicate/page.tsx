"use client";

import { useState, useEffect, useTransition } from "react";
import { 
  HardDrive, 
  Search, 
  Trash2, 
  RefreshCw,
  FileWarning,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  triggerScan, 
  analyzeDuplicates, 
  getDuplicateGroups, 
  deleteFiles,
  getScanStats,
  getScanProgress
} from "@/app/actions";
import Link from "next/link";

interface DuplicateFile {
  id: string;
  name: string;
  path: string;
  size: bigint;
  mtime: Date | null;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  files: DuplicateFile[];
  wastedSpace: number;
}

interface Stats {
  totalFiles: number;
  hashedFiles: number;
  totalSize: number;
  wastedSpace: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function DeduplicatePage() {
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState<Stats | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "hashing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  // 加载初始数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, groups] = await Promise.all([
        getScanStats(),
        getDuplicateGroups()
      ]);
      setStats(statsData);
      setDuplicateGroups(groups);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  // 开始扫描
  const handleScan = () => {
    startTransition(async () => {
      setScanStatus("scanning");
      setMessage("正在扫描文件系统...");
      setProgress(10);

      const result = await triggerScan();
      
      if (result.success) {
        setProgress(50);
        setScanStatus("hashing");
        setMessage("正在分析重复文件...");
        
        await analyzeDuplicates();
        
        setProgress(100);
        setScanStatus("done");
        setMessage(`扫描完成！发现 ${result.count} 个文件`);
        
        // 刷新数据
        await loadData();
      } else {
        setScanStatus("error");
        setMessage(result.error || "扫描失败");
      }
    });
  };

  // 切换组展开/折叠
  const toggleGroup = (hash: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(hash)) {
      newExpanded.delete(hash);
    } else {
      newExpanded.add(hash);
    }
    setExpandedGroups(newExpanded);
  };

  // 切换文件选择
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // 选择组内除第一个外的所有文件（智能选择）
  const selectDuplicatesInGroup = (group: DuplicateGroup) => {
    const newSelected = new Set(selectedFiles);
    // 跳过第一个（保留最新的），选择其余的
    group.files.slice(1).forEach(file => {
      newSelected.add(file.id);
    });
    setSelectedFiles(newSelected);
  };

  // 删除选中的文件
  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    startTransition(async () => {
      const result = await deleteFiles(Array.from(selectedFiles));
      
      if (result.success) {
        setMessage(`成功删除 ${result.deletedCount} 个文件`);
        setSelectedFiles(new Set());
        await loadData();
      } else {
        setMessage(`删除完成，${result.deletedCount} 成功，${result.errors.length} 失败`);
      }
    });
  };

  const totalWastedSpace = duplicateGroups.reduce((sum, g) => sum + g.wastedSpace, 0);
  const totalDuplicateFiles = duplicateGroups.reduce((sum, g) => sum + g.files.length - 1, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Copy className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">重复文件清理</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedFiles.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  删除选中 ({selectedFiles.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    您即将删除 {selectedFiles.size} 个文件。此操作不可撤销！
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteSelected}>
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">已扫描文件</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalFiles || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats ? formatBytes(stats.totalSize) : "0 B"} 总大小
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">重复文件组</CardTitle>
              <FileWarning className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{duplicateGroups.length}</div>
              <p className="text-xs text-muted-foreground">
                共 {totalDuplicateFiles} 个可清理文件
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">可节省空间</CardTitle>
              <Trash2 className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {formatBytes(totalWastedSpace)}
              </div>
              <p className="text-xs text-muted-foreground">
                删除重复后可释放
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">已选中</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {selectedFiles.size}
              </div>
              <p className="text-xs text-muted-foreground">
                个文件待删除
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scan Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              扫描控制
            </CardTitle>
            <CardDescription>
              扫描文件系统并分析重复文件
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleScan} 
                disabled={isPending || scanStatus === "scanning" || scanStatus === "hashing"}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                {scanStatus === "scanning" || scanStatus === "hashing" ? "扫描中..." : "开始扫描"}
              </Button>
              
              {message && (
                <div className="flex items-center gap-2 text-sm">
                  {scanStatus === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {scanStatus === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                  {(scanStatus === "scanning" || scanStatus === "hashing") && (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  <span className={
                    scanStatus === "done" ? "text-green-500" :
                    scanStatus === "error" ? "text-red-500" :
                    "text-muted-foreground"
                  }>
                    {message}
                  </span>
                </div>
              )}
            </div>

            {(scanStatus === "scanning" || scanStatus === "hashing") && (
              <Progress value={progress} className="h-2" />
            )}
          </CardContent>
        </Card>

        {/* Duplicate Groups List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileWarning className="h-5 w-5" />
                重复文件列表
              </span>
              {duplicateGroups.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    duplicateGroups.forEach(g => selectDuplicatesInGroup(g));
                  }}
                >
                  智能选择所有重复项
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              点击展开查看每组重复文件的详细信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            {duplicateGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileWarning className="h-12 w-12 mb-4 opacity-50" />
                <p>暂无重复文件</p>
                <p className="text-sm">点击"开始扫描"来分析您的文件</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {duplicateGroups.map((group) => (
                    <div
                      key={group.hash}
                      className="rounded-lg border border-border overflow-hidden"
                    >
                      {/* Group Header */}
                      <button
                        onClick={() => toggleGroup(group.hash)}
                        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {expandedGroups.has(group.hash) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div className="text-left">
                            <p className="font-medium">
                              {group.files[0]?.name}
                              <Badge variant="secondary" className="ml-2">
                                {group.files.length} 个副本
                              </Badge>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              单文件 {formatBytes(group.size)} · 可节省 {formatBytes(group.wastedSpace)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectDuplicatesInGroup(group);
                          }}
                        >
                          选择重复项
                        </Button>
                      </button>

                      {/* Expanded Files List */}
                      {expandedGroups.has(group.hash) && (
                        <div className="border-t border-border bg-muted/30">
                          {group.files.map((file, index) => (
                            <div
                              key={file.id}
                              className={`flex items-center gap-3 px-4 py-3 ${
                                index !== group.files.length - 1 ? "border-b border-border/50" : ""
                              }`}
                            >
                              <Checkbox
                                checked={selectedFiles.has(file.id)}
                                onCheckedChange={() => toggleFileSelection(file.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate flex items-center gap-2">
                                  {file.name}
                                  {index === 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      保留
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {file.path}
                                </p>
                              </div>
                              <div className="text-right text-sm text-muted-foreground">
                                <p>{formatBytes(Number(file.size))}</p>
                                <p>{formatDate(file.mtime)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
