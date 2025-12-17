// API service for LiDAR backend

import type {
  FileUploadResponse,
  FileInfo,
  PointCloudData,
  PointCloudMetadata,
} from "../types/lidar";

const API_BASE_URL = "/api/v1";

export const LidarAPI = {
  async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error ${response.status}`);
    }
    return response.json();
  },

  async uploadFile(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    return this.handleResponse<FileUploadResponse>(response);
  },

  async listFiles(): Promise<FileInfo[]> {
    const response = await fetch(`${API_BASE_URL}/files`);
    return this.handleResponse<FileInfo[]>(response);
  },

  async getFileInfo(fileId: string): Promise<PointCloudMetadata> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/info`);
    return this.handleResponse<PointCloudMetadata>(response);
  },

  async getPointData(
    fileId: string,
    options: {
      maxPoints?: number;
      colorBy?: "height" | "intensity" | "original";
      downsample?: number;
    } = {}
  ): Promise<PointCloudData> {
    const params = new URLSearchParams();

    if (options.maxPoints)
      params.append("max_points", options.maxPoints.toString());
    if (options.colorBy) params.append("color_by", options.colorBy);
    if (options.downsample)
      params.append("downsample", options.downsample.toString());

    const response = await fetch(
      `${API_BASE_URL}/files/${fileId}/points?${params}`
    );
    return this.handleResponse<PointCloudData>(response);
  },

  async deleteFile(fileId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      method: "DELETE",
    });
    return this.handleResponse<{ message: string }>(response);
  },
};
