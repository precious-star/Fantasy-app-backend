const mongoose = require("mongoose");

const teamEntrieSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
    },
    players:{
        type: Array,
        required: true
    },
    captainName:{
        type: String,
        required : true
    },
    viceCaptainName:{
        type: String,
        required : true
    },
    ifscoredProccessed:{
        type: Boolean,
        default: false 
      },
    teamPlayerPoints:{
        type: Number,
        default:0
    },
    isWinner:{
        type: Boolean,
        default: false,
    },
    totalExtraRuns:{
        type: Number,
        default: 0
    }
  },
  {
    timestamps: true,
  }
);
const TeamEntrieSchema = mongoose.model("teamEntries", teamEntrieSchema);

module.exports = TeamEntrieSchema;
