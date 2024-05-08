const mongoose  = require("mongoose");
const dbConnect = async () => {
    try{
       const connectionInstance =  await mongoose.connect('mongodb://localhost:27017/task-');
       console.log(`mongo db connected!!`)
    }catch(err){
        console.log(`Error while connecting with DB ${err}`);
        process.exit(1);

    }
}

module.exports =  { dbConnect };