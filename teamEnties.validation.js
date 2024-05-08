const Joi = require('joi')

const addTeamValidationSchema = Joi.object({
    teamName: Joi.string().required(),
    players: Joi.array().items(Joi.string()).required(),
    captainName: Joi.string().required(),
    viceCaptainName: Joi.string().required(),
  });

module.exports = {
  addTeamValidationSchema
}