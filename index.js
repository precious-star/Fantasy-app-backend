const express = require('express');
const app = express();
const port = 3000;
const { addTeamValidationSchema } = require('./teamEnties.validation.js')
const { addTeam , processResult, getTeamResult} = require('./teamEntries.controller')
const { dbConnect } = require('./db.js')
const  validate  = require('./utils');

app.use(express.json())
// Endpoints
app.post('/add-team',validate(addTeamValidationSchema),addTeam);
app.post('/process-result',processResult);
app.get('/team-result',getTeamResult)


app.listen(port,async() => {
  await dbConnect();
  console.log(`App listening on port ${port}`);
});
