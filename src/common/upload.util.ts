import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

/**
 * Reads a multipart upload with per-route limits, checked while streaming (so an
 * oversized upload is cut off instead of filling memory), and only the given types.
 */
export async function readUploads(
  req: any,
  opts: { kind: 'image' | 'video'; maxFiles: number; maxFileMb: number },
): Promise<{ buffer: Buffer; mimetype: string }[]> {
  const files: { buffer: Buffer; mimetype: string }[] = [];
  const type = opts.kind === 'image' ? /^image\// : /^video\//;
  try {
    for await (const part of req.parts({ limits: { files: opts.maxFiles, fileSize: opts.maxFileMb * 1024 * 1024 } })) {
      if (part.type !== 'file') continue;
      const mimetype = String(part.mimetype || '').toLowerCase();
      if (!type.test(mimetype)) {
        part.file.resume(); // drain it
        throw new BadRequestException(opts.kind === 'image' ? 'Only photos can be uploaded here' : 'Only videos can be uploaded here');
      }
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(Buffer.from(chunk));
      files.push({ buffer: Buffer.concat(chunks), mimetype });
    }
  } catch (err: any) {
    if (err instanceof BadRequestException) throw err;
    const code = String(err?.code ?? '');
    if (code === 'FST_REQ_FILE_TOO_LARGE') throw new PayloadTooLargeException(`Each file can be up to ${opts.maxFileMb} MB`);
    if (code === 'FST_FILES_LIMIT') throw new PayloadTooLargeException(`Up to ${opts.maxFiles} files at a time`);
    throw err;
  }
  if (!files.length) throw new BadRequestException('No file uploaded');
  return files;
}
