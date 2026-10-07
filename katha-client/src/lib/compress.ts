import imageCompression from "browser-image-compression";

export const compressToWebP = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: "image/webp" as const,
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    return new File([compressedBlob], `katha_${Date.now()}.webp`, {
      type: "image/webp",
    });
  } catch (error) {
    console.error("Compression failed, using original file", error);
    return file;
  }
};