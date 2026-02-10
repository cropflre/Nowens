"use client";

import { ChevronRight, Home } from "lucide-react";
import { useFileStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function FileBreadcrumb() {
  const { currentPath, setPath } = useFileStore();

  return (
    <div className="flex items-center text-sm text-muted-foreground mb-4 overflow-x-auto whitespace-nowrap pb-2">
      {currentPath.map((item, index) => {
        const isLast = index === currentPath.length - 1;
        
        return (
          <div key={item.id} className="flex items-center">
            {index > 0 && <ChevronRight className="h-4 w-4 mx-1 opacity-50" />}
            
            <button
              onClick={() => {
                // 点击面包屑跳转到对应层级
                if (!isLast) {
                  setPath(currentPath.slice(0, index + 1));
                }
              }}
              className={cn(
                "hover:text-foreground transition-colors flex items-center px-1 rounded-md hover:bg-muted/50",
                isLast && "font-semibold text-foreground cursor-default hover:bg-transparent"
              )}
              disabled={isLast}
            >
              {index === 0 ? <Home className="h-4 w-4 mr-1" /> : null}
              {item.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}
