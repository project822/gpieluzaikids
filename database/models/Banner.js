import mongoose from 'mongoose';

const BannerSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, default: '' },
    caption: { type: String, default: '' },
    image: { type: String, required: true },
    // Tautan opsional: jika diisi, banner menjadi dapat diklik dan
    // mengarah ke halaman event (/event/...) atau situs eksternal (https://...).
    // Jika kosong, banner hanya tampil (tidak bisa diklik).
    link: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Banner || mongoose.model('Banner', BannerSchema);
