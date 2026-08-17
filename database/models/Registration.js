import mongoose from 'mongoose';

const RegistrationSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, index: true },
    eventName: { type: String, default: '' },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    whatsapp: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.Registration || mongoose.model('Registration', RegistrationSchema);
