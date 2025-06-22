import { API_URL } from "./index";

/**
 * Uploads a file to the server
 * @param file The file to upload
 * @returns A promise that resolves to the URL of the uploaded file
 */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  // Construct the upload URL
  const uploadUrl = `${API_URL}/api/upload/image`;

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      // Add necessary headers for file upload
      headers: {
        // Don't set Content-Type header as it's automatically set with boundary for FormData
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Upload response error:", response.status, errorText);
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error("Upload request failed:", error);
    throw error;
  }
} 