const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;

function ensureCloudinaryEnv() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Missing Cloudinary env vars (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET).");
  }

  return { cloudName, uploadPreset };
}

async function uploadFile(file, folder) {
  const { cloudName, uploadPreset } = ensureCloudinaryEnv();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed: ${text}`);
  }

  const data = await response.json();
  return data.secure_url;
}

export async function uploadImagesToCloudinary(files) {
  const images = Array.from(files || []);

  for (const image of images) {
    if (!image.type?.startsWith("image/")) {
      throw new Error("Only image files can be uploaded for boat galleries.");
    }

    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`${image.name} is too large. Keep boat photos under 10MB each.`);
    }
  }

  return Promise.all(images.map((image) => uploadFile(image, "boats")));
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
