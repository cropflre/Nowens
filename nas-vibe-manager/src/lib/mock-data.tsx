import { Folder, ImageIcon, Film, Music, FileText, File as FileIcon } from "lucide-react";

export type FileType = "folder" | "image" | "video" | "audio" | "document" | "unknown";

export interface FileObj {
  id: string;
  parentId: string | null; // 核心字段：用于层级关联
  name: string;
  type: FileType;
  size?: number;
  updatedAt: Date;
}

// 模拟一个稍微丰富点的文件树
export const mockFiles: FileObj[] = [
  // Root Level (parentId: null)
  { id: "1", parentId: null, name: "Movies", type: "folder", updatedAt: new Date("2024-01-20") },
  { id: "2", parentId: null, name: "Work Documents", type: "folder", updatedAt: new Date("2024-02-10") },
  { id: "3", parentId: null, name: "System_Log.txt", type: "document", size: 1024, updatedAt: new Date("2024-02-28") },

  // Inside Movies (id: 1)
  { id: "11", parentId: "1", name: "Action", type: "folder", updatedAt: new Date("2023-11-01") },
  { id: "12", parentId: "1", name: "Interstellar.mkv", type: "video", size: 15000000000, updatedAt: new Date("2023-12-05") },
  { id: "13", parentId: "1", name: "Inception.mp4", type: "video", size: 8000000000, updatedAt: new Date("2023-12-06") },

  // Inside Work Documents (id: 2)
  { id: "21", parentId: "2", name: "Resume_2024.pdf", type: "document", size: 450000, updatedAt: new Date("2024-02-15") },
  { id: "22", parentId: "2", name: "Project_Vibe_Proposal.docx", type: "document", size: 23000, updatedAt: new Date("2024-02-18") },
  
  // Inside Movies > Action (id: 11)
  { id: "111", parentId: "11", name: "John_Wick_4.mp4", type: "video", size: 12000000000, updatedAt: new Date("2024-01-10") },
];

// Helper to get Icon
export const getFileIcon = (type: FileType, className?: string) => {
  const props = { className: className || "w-6 h-6" };
  switch (type) {
    case "folder": return <Folder {...props} className={`${props.className} text-blue-500 fill-blue-500/20`} />;
    case "image": return <ImageIcon {...props} className={`${props.className} text-purple-500`} />;
    case "video": return <Film {...props} className={`${props.className} text-red-500`} />;
    case "audio": return <Music {...props} className={`${props.className} text-yellow-500`} />;
    case "document": return <FileText {...props} className={`${props.className} text-slate-500`} />;
    default: return <FileIcon {...props} className={`${props.className} text-gray-400`} />;
  }
};
