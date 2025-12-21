export const cloudinaryConfig = {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
};

export const openUploadWidget = (options: any, callback: (error: any, result: any) => void) => {
    if (typeof window === 'undefined' || !(window as any).cloudinary) {
        console.error('Cloudinary SDK not loaded');
        return;
    }

    const widget = (window as any).cloudinary.createUploadWidget(
        {
            cloudName: cloudinaryConfig.cloudName,
            uploadPreset: cloudinaryConfig.uploadPreset,
            ...options,
        },
        callback
    );

    widget.open();
};
