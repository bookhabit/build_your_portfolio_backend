import mongoose from "mongoose";
import { Schema } from "mongoose";

const PortfolioSchema = new Schema({
    author:{type:Schema.Types.ObjectId, ref:'User'},
    title:String, 
    purpose:String,
    introduce:String, 
    process:[String],
    learned:[String],
    photos:[String],
    usedTechnology:[String],
    demoLink:{
        projectURL:String,
        githubURL:String,
        designURL:String,
        documentURL:String,
    },
    developPeriod:{
        start:String,
        end:String,
    },
    important_functions:[{
        important_function_desc:String,
        important_function_photo:[String],
    }],
    category:String,
    selectedUI:String,
},{
    timestamps: true,
});

const PortfolioModel = mongoose.model('Portfolio', PortfolioSchema);

export default PortfolioModel;