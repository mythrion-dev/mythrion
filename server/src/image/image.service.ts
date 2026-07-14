import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common'
import { MongoClient, GridFSBucket, type Db, type ObjectId } from 'mongodb'
import { Readable } from 'stream'

const BUCKET_NAME = 'avatars'

interface GridFsFile {
  _id: ObjectId
  filename: string
  metadata?: { sheetId?: string; contentType?: string }
  length: number
  uploadDate: Date
}

@Injectable()
export class ImageService implements OnModuleInit {
  private readonly logger = new Logger(ImageService.name)
  private client: MongoClient | null = null
  private db: Db | null = null
  private bucket: GridFSBucket | null = null

  async onModuleInit() {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      this.logger.warn('MONGODB_URI not set — image uploads will be unavailable')
      return
    }

    try {
      this.client = new MongoClient(uri)
      await this.client.connect()
      this.db = this.client.db() // uses the database from the URI
      this.bucket = new GridFSBucket(this.db, { bucketName: BUCKET_NAME })
      this.logger.log('Connected to MongoDB for image storage')
    } catch (err) {
      this.logger.error('Failed to connect to MongoDB', err)
    }
  }

  /** Guard: throw if not connected */
  private ensureReady() {
    if (!this.bucket || !this.db) {
      throw new NotFoundException('Image storage is not available')
    }
  }

  /**
   * Upload a file to GridFS, keyed by `sheetId`.
   * Deletes any existing file for the same sheetId first.
   */
  async upload(
    sheetId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ fileId: string }> {
    this.ensureReady()

    // Remove any previous avatar for this sheet
    await this.delete(sheetId).catch(() => {
      /* no-op if none existed */
    })

    return new Promise((resolve, reject) => {
      const uploadStream = this.bucket!.openUploadStream(sheetId, {
        metadata: { sheetId, contentType: file.mimetype },
      })

      const readable = new Readable()
      readable.push(file.buffer)
      readable.push(null)

      readable
        .pipe(uploadStream)
        .on('error', (err) => {
          this.logger.error(`Upload error for sheet ${sheetId}`, err)
          reject(err)
        })
        .on('finish', () => {
          resolve({ fileId: uploadStream.id.toString() })
        })
    })
  }

  /**
   * Return metadata + a Readable stream for the avatar belonging to `sheetId`.
   * Throws NotFoundException if no file exists.
   */
  async getStream(
    sheetId: string,
  ): Promise<{ stream: Readable; contentType: string; contentLength: number }> {
    this.ensureReady()

    const files = await this.db!
      .collection(`${BUCKET_NAME}.files`)
      .find({ 'metadata.sheetId': sheetId })
      .sort({ uploadDate: -1 })
      .limit(1)
      .toArray()

    if (files.length === 0) {
      throw new NotFoundException('Avatar not found')
    }

    const file = files[0] as unknown as GridFsFile
    const stream = this.bucket!.openDownloadStream(file._id)

    return {
      stream,
      contentType: file.metadata?.contentType ?? 'application/octet-stream',
      contentLength: file.length,
    }
  }

  /** Delete all avatar files for a given sheetId. */
  async delete(sheetId: string): Promise<void> {
    this.ensureReady()

    const files = await this.db!
      .collection(`${BUCKET_NAME}.files`)
      .find({ 'metadata.sheetId': sheetId })
      .toArray()

    for (const file of files) {
      try {
        const gridFile = file as unknown as GridFsFile
        await this.bucket!.delete(gridFile._id)
      } catch (err) {
        this.logger.warn(`Failed to delete file ${file._id}`, err)
      }
    }
  }
}
