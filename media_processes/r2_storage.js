const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const path = require("path");

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "4dffa334f65a3162f5bd6372de42759f";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "e964b7b6440321b7b729dd89206f217a";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "9bc4aed8e61ce289fb9b3be5f034c2d8f8993843b67904fbb0102ff45b23df97";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "ai-extension";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://cdn.aradhangini.com";

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

async function uploadFile(fileBuffer, fileName, contentType, folder = "uploads") {
    try {
        const fileExt = path.extname(fileName);
        const uniqueFileName = `${crypto.randomUUID()}${fileExt}`;
        const datePath = new Date().toISOString().split("T")[0].replace(/-/g, "/");
        const objectKey = `${folder}/${datePath}/${uniqueFileName}`;

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: objectKey,
            Body: fileBuffer,
            ContentType: contentType || "application/octet-stream",
            Metadata: {
                original_filename: fileName,
                uploaded_at: new Date().toISOString(),
            },
        });

        await s3Client.send(command);
        const fileUrl = `${R2_PUBLIC_URL}/${objectKey}`;

        return { success: true, fileUrl };
    } catch (error) {
        console.error("R2 upload failed:", error);
        return { success: false, error: error.message };
    }
}

module.exports = { uploadFile };
