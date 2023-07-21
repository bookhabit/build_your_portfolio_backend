import mongoose from "mongoose";
import { Schema } from "mongoose";

const PostSchema = new Schema({
    author:{type:Schema.Types.ObjectId, ref:'User'},
    title: String,
    description: String,
    photos: [String],
},{
    timestamps: true,
});

const PostModel = mongoose.model('Post', PostSchema);

export default PostModel;