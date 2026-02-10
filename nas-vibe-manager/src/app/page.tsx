"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, HardDrive, UploadCloud } from "lucide-react";
import { FileBrowser } from "@/components/file-browser";
import { FileBreadcrumb } from "@/components/file-breadcrumb";

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-6 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
             <HardDrive className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">GreenNAS</h1>
        </div>

        <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative w-64 hidden md:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search..." className="pl-9 bg-muted/50 border-none h-9" />
            </div>
            <Button size="sm" className="gap-2 h-9">
                <UploadCloud className="h-4 w-4" /> <span className="hidden sm:inline">Upload</span>
            </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <FileBreadcrumb />
        <FileBrowser />
      </main>
    </div>
  );
}
