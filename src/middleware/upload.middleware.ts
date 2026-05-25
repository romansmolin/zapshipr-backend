import multer from 'multer'

const storage = multer.memoryStorage()
const maxFileSizeMb = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? '500')
const maxFileSizeBytes =
    Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 ? maxFileSizeMb * 1024 * 1024 : 500 * 1024 * 1024
const maxFilesRaw = Number(process.env.UPLOAD_MAX_FILES ?? '12')
const maxFiles = Number.isInteger(maxFilesRaw) && maxFilesRaw > 0 ? maxFilesRaw : 12

export const upload = multer({
    storage,
    limits: {
        fileSize: maxFileSizeBytes,
        files: maxFiles,
    },
})
