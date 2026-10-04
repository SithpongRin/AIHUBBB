// Vercel Serverless Function: /api/files/upload
// Validates file uploads and performs initial text extraction.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { fileName, fileType, fileSize, textContent, userId } = req.body || {};

  if (!fileName || !userId) {
    return res.status(400).json({ success: false, error: 'Missing fileName or userId' });
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (fileSize && fileSize > MAX_SIZE) {
    return res.status(400).json({ success: false, error: 'File exceeds 5MB size limit' });
  }

  // Sanitize extracted text
  const sanitizedText = (textContent || '').slice(0, 50000);

  return res.status(200).json({
    success: true,
    file: {
      fileName,
      fileType,
      fileSize,
      extractedSnippet: sanitizedText.slice(0, 500),
    },
  });
}
