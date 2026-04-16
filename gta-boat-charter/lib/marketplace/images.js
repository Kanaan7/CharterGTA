const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;

function ensureCloudinaryEnv() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Missing Cloudinary env vars (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET).");
  }

  return { cloudName, uploadPreset };
}

function buildVideoPosterUrl(url) {
  if (!url || !url.includes("/video/upload/")) return "";
  const transformed = url.replace("/video/upload/", "/video/upload/so_0,f_jpg/");
  return transformed.replace(/\.[^./?]+(\?.*)?$/, ".jpg$1");
}

async function uploadFile(file, folder) {
  const { cloudName, uploadPreset } = ensureCloudinaryEnv();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed: ${text}`);
  }

  const data = await response.json();
  return {
    id: data.asset_id || data.public_id || data.secure_url,
    type: data.resource_type === "video" ? "video" : "image",
    url: data.secure_url,
    thumbnailUrl: data.resource_type === "video" ? buildVideoPosterUrl(data.secure_url) : data.secure_url,
  };
}

export async function uploadImagesToCloudinary(files) {
  const mediaFiles = Array.from(files || []);

  for (const file of mediaFiles) {
    const isImage = file.type?.startsWith("image/");
    const isVideo = file.type?.startsWith("video/");

    if (!isImage && !isVideo) {
      throw new Error("Only image and video files can be uploaded for boat galleries.");
    }

    if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`${file.name} is too large. Keep photos under 10MB each.`);
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new Error(`${file.name} is too large. Keep videos under 100MB each.`);
    }
  }

  return Promise.all(mediaFiles.map((file) => uploadFile(file, "boats")));
}

export async function uploadMessageAttachmentToCloudinary(file) {
  if (!file) return null;

  if (!file.type?.startsWith("image/")) {
    throw new Error("Only image attachments are supported right now.");
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("Attachments must be under 8MB.");
  }

  return uploadFile(file, "messages");
}
