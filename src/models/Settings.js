const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    description: {
        type: String,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

// Static method to get a setting by key
settingsSchema.statics.get = async function (key, defaultValue = null) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : defaultValue;
};

// Static method to set a setting
settingsSchema.statics.set = async function (key, value, userId = null, description = null) {
    const update = { value, updatedBy: userId };
    if (description) update.description = description;

    return this.findOneAndUpdate(
        { key },
        update,
        { upsert: true, new: true }
    );
};

// Static method to get all settings as object
settingsSchema.statics.getAll = async function () {
    const settings = await this.find();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    return result;
};

module.exports = mongoose.model('Settings', settingsSchema);
