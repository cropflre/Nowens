"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileObj } from "@/lib/mock-data";

interface MediaViewerProps {
  file: FileObj | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaViewer({ file, isOpen, onClose }: MediaViewerProps) {
  if (!file) return null;

  const fileUrl = `/api/file?path=${encodeURIComponent(file.id)}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black border-none text-white [&>button]:text-white [&>button]:hover:bg-white/20">
        <DialogHeader className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <DialogTitle className="text-white text-lg font-normal truncate pr-8">{file.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center min-h-[50vh] bg-black">
          {file.type === "video" && (
            <video 
              controls 
              autoPlay 
              className="w-full max-h-[80vh]" 
              src={fileUrl}
            >
              Your browser does not support the video tag.
            </video>
          )}

          {file.type === "image" && (
             // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={fileUrl} 
              alt={file.name} 
              className="max-w-full max-h-[80vh] object-contain" 
            />
          )}
          
          {file.type === "audio" && (
            <div className="w-full p-10 flex flex-col items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
                <audio controls className="w-full max-w-md" src={fileUrl} autoPlay />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
