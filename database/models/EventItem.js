import mongoose from 'mongoose';

const CustomFormFieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'email', 'tel', 'number', 'select', 'checkbox', 'textarea'], default: 'text' },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    placeholder: { type: String, default: '' },
  },
  { _id: false }
);

const EventItemSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    theme: { type: String, default: '' },
    date: { type: String, required: true },
    openGate: { type: String, default: '' },
    time: { type: String, default: '' },
    location: { type: String, default: '' },
    mapsLink: { type: String, default: '' },
    formLink: { type: String, default: '' },
    formActive: { type: Boolean, default: false },
    formTitle: { type: String, default: '' },
    photoLink: { type: String, default: '' },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    customFormFields: { type: [CustomFormFieldSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.EventItem || mongoose.model('EventItem', EventItemSchema);
