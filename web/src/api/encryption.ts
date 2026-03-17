import http from '@/utils/http'
import type { ApiResponse } from '@/types'

// 加密文件
export function encryptFile(data: { file_id: number; password: string }) {
  return http.post<any, ApiResponse>('/files/encrypt', data)
}

// 解密文件
export function decryptFile(data: { file_id: number; password: string }) {
  return http.post<any, ApiResponse>('/files/decrypt', data)
}

// 临时解密下载
export function decryptDownload(data: { file_id: number; password: string }) {
  return http.post<any, ApiResponse>('/files/decrypt-download', data, {
    responseType: 'blob',
  })
}
