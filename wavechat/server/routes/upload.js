const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../utils/multer');
const cloudinary = require('../utils/cloudinary');

router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'auto',
      folder: 'wavechat',
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
      type: result.resource_type,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
