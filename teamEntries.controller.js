const fs = require("fs");
const teamEntrieSchema = require("./teamEntries.model");

const addTeam = async (req, res) => {
  const { body } = req;
  let cskCount = 0,
    rrCount = 0,
    wickerKeeperCount = 0,
    BatterCount = 0,
    allRounderCount = 0,
    BowlerCount = 0;
  const players = [];
  const selectedPlayer = new Map();
  if (body.captainName === body.viceCaptainName) {
    res.send({
      status: false,
      message: "captainName and viceCaptainName can not be same player",
    });
    return;
  }
  if (body.players.length !== 11) {
    res.send({
      status: false,
      message: "Must have 11 players",
    });
    return;
  }
  const playerDetails = new Map();
  let playersData = fs.readFileSync("./data/players.json", {
    encoding: "utf-8",
  });
  playersData = JSON.parse(playersData);
  playersData.map((player) => {
    playerDetails.set(player.Player, player);
  });
  for (const player of body.players) {
    const available = playerDetails.get(player);
    if (!available) {
      res.send({
        status: false,
        message: `${player} is not playing in any of teams which is playing match`,
      });
      return;
    }
    if (available.Team === "Chennai Super Kings") {
      cskCount++;
    } else {
      rrCount++;
    }
    if (selectedPlayer.get(player)) {
      res.send({
        status: false,
        message: `same player can not be choosen more then once`,
      });
      return;
    } else {
      selectedPlayer.set(player, true);
    }

    switch (available.Role) {
      case "WICKETKEEPER":
        wickerKeeperCount++;
        break;
      case "ALL-ROUNDER":
        allRounderCount++;
        break;
      case "BOWLER":
        BowlerCount++;
        break;
      case "BATTER":
        BatterCount++;
        break;
      default:
    }
    players.push({ name: player, point: 0 });
  }
  if (cskCount > 10 || rrCount > 10) {
    res.send({
      status: false,
      message: "can not choose more then 10 player from a team ",
    });
    return;
  }
  if (
    wickerKeeperCount < 1 ||
    wickerKeeperCount > 8 ||
    allRounderCount < 1 ||
    allRounderCount > 8 ||
    BowlerCount < 1 ||
    BowlerCount > 8 ||
    BatterCount < 1 ||
    BatterCount > 8
  ) {
    res.send({
      status: false,
      message:
        "Wicket Keeper/Batter/All Rounder/Bowler count can not be less than 1 and grater than 8",
    });
    return;
  }
  body.players = players;
  const result = await teamEntrieSchema.create(body);
  res.send({ status: true, result: result });
};

const getTeamResult = async (req, res) => {
  let teams = await teamEntrieSchema.find({ ifscoredProccessed: true }).lean()
  let maxPoint = 0;
  teams = teams.map(( team ) => {
    team.teamTotalPoints = team.totalExtraRuns + team.teamPlayerPoints;
    if (team.teamTotalPoints > maxPoint) {
      maxPoint = team.teamTotalPoints;
    }
    return team;
  });
  const finalArr = teams.map((teamDetails) => {
    if (teamDetails.teamTotalPoints === maxPoint) {
      teamDetails.isWinner = true;
    }
    return teamDetails;
  });
  res.send({ status: false, result: finalArr });
};

const processResult = async (req, res) => {
  const teams = await teamEntrieSchema.find({ ifscoredProccessed: false }).lean();
  let totalExtraRuns = 0;
  for (let team of teams) {
    const playerDetails = new Map();
    const bollwingDataMap = new Map();
    team.players.map((player) => {
      playerDetails.set(player.name, {
        totalPoints: 0,
        thirtyRunBouns: false,
        halfCenturyBonus: false,
        centuryBonus: false,
        run: 0,
        numberOfCaugh: 0,
        isDuck: false
      });
    });
    let matchData = fs.readFileSync("./data/match.json", {
      encoding: "utf-8",
    });
    matchData = JSON.parse(matchData);
    for (const data of matchData) {
      await calculateBatterPoints(playerDetails, data);
      await calculateFildersPoint(playerDetails, data);
      await calculatePerBollerOvers(bollwingDataMap, data);
    }
    totalExtraRuns = await calculateBowlingPoints(bollwingDataMap, playerDetails);
    console.log(" final totalExtraRuns",totalExtraRuns)
    const finalArr = [];
    let teamTotalPoint = 0;
    for (const [key, value] of playerDetails) {
      if(value.isDuck){
        value.totalPoints = -2;
      }
      if (key === team.viceCaptainName) {
        value.totalPoints = value.totalPoints * 1.5;
      }
      if (key === team.captainName) {
        value.totalPoints = value.totalPoints * 2;
      }
      teamTotalPoint = teamTotalPoint + value.totalPoints;
     
      finalArr.push({ name: key, point: value.totalPoints });
    }

     await teamEntrieSchema.updateOne(
      { _id: team._id },
      {
        $set: {
          players: finalArr,
          ifscoredProccessed: true,
          teamPlayerPoints: teamTotalPoint,
          totalExtraRuns
        },
      }
    );
    res.send({ status: true, message: "data processed" });
    return;
  }
  res.send({ status: false, result: "No data to process" });
};

async function calculateBowlingPoints(bollwingDataMap, playerDetails) {
  let totalExtraRuns = 0;
  for (let [key, value] of bollwingDataMap) {
    const isBowlerPlaying = playerDetails.get(key);
    if (isBowlerPlaying) {
      let totalPoints = 0;
      for (let [key1, value1] of value.overs) {
        totalExtraRuns = totalExtraRuns + value1.extraRuns;
        totalPoints = totalPoints + value1.wicketsPoint + value1.lbwBowledBouns;
        if (value1.isMaidenOver) {
          totalPoints = totalPoints + 12;
        }
        if (value1.wickets >= 3) {
          totalPoints = totalPoints + 4;
        }
        if (value1.wickets >= 4) {
          totalPoints = totalPoints + 8;
        }
        if (value1.wickets >= 5) {
          totalPoints = totalPoints + 16;
        }
      }
      isBowlerPlaying.totalPoints = isBowlerPlaying.totalPoints + totalPoints;
      playerDetails.set(key, isBowlerPlaying);
    }
  }
  return totalExtraRuns;
}

async function calculateFildersPoint(playerDetails, data) {
  if (data.fielders_involved !== "NA") {
    const playerData = playerDetails.get(data.fielders_involved);
    if (playerData) {
      if (data.kind === "caught") {
        playerData.totalPoints = playerData.totalPoints + 8;
        playerData.numberOfCaugh++;
      }
      playerData.totalPoints =
        playerData.totalPoints +
        (data.kind === "stump" && isWicketDelivery ? 12 : 0);
      playerData.totalPoints =
        playerData.totalPoints +
        (data.kind === "runout" && isWicketDelivery ? 6 : 0);
      if (playerData.numberOfCaugh === 3) {
        playerData.totalPoints = playerData.totalPoints + 4;
      }
      playerDetails.set(data.fielders_involved, playerData);
    }
  }
}

async function calculateBatterPoints(playerDetails, data) {
  const playerData = playerDetails.get(data.batter);
  if (playerData) {
    playerData.totalPoints = playerData.totalPoints + data.batsman_run;
    playerData.run = playerData.run + data.batsman_run;
    if (data.batsman_run === 4) {
      playerData.totalPoints = playerData.totalPoints + 1;
    }
    if (data.batsman_run === 6) {
      playerData.totalPoints = playerData.totalPoints + 2;
    }
    if (
      (playerData.run === 30 || playerData.run > 30) &&
      !playerData.thirtyRunBouns
    ) {
      playerData.totalPoints = playerData.totalPoints + 4;
      playerData.thirtyRunBouns = true;
    }
    if (
      (playerData.run === 50 || playerData.run > 50) &&
      !playerData.halfCenturyBonus
    ) {
      playerData.totalPoints = playerData.totalPoints + 4;
      playerData.halfCenturyBonus = true;
    }
    if (
      (playerData.run === 100 || playerData.run > 100) &&
      !playerData.halfCenturyBonus
    ) {
      playerData.totalPoints = playerData.totalPoints + 16;
      playerData.centuryBonus = true;
    }
    if(playerData.totalPoints === 0) playerData.isDuck = true
    if(playerData.totalPoints > 0) playerData.isDuck = false
    playerDetails.set(data.batter, playerData);
  }
}

async function calculatePerBollerOvers(bollwingDataMap, data) {
  const bowller = bollwingDataMap.get(data.bowler);
  const overs = new Map();
  if (bowller) {
    let over = bowller.overs?.get(data.overs);
    if (!over) {
      bowller.overs.set(data.overs, {
        runsScored: data.total_run,
        isMaidenOver: false,
        wicketsPoint:
          data.isWicketDelivery === 1 &&
          (data.kind !== "lbw" || data.kind !== "runout")
            ? 25
            : 0,
        lbwBowledBouns: data.kind === "caugh" || data.kind === "lbw" ? 8 : 0,
        wickets: data.isWicketDelivery === 1 ? 1 : 0,
        extraRuns: data.extras_run
      });
    } else {
      bowller.overs.set(data.overs, {
        runsScored: over.runsScored + data.total_run,
        isMaidenOver: over.runsScored + data.total_run === 0 ? true : false,
        wicketsPoint:
          data.isWicketDelivery === 1 &&
          (data.kind !== "lbw" || data.kind !== "runout")
            ? over.wicketsPoint + 25
            : over.wicketsPoint + 0,
        lbwBowledBouns:
          data.kind === "caugh" || data.kind === "lbw"
            ? over.lbwBowledBouns + 8
            : over.lbwBowledBouns + 0,
        wickets: over.wickets + (data.isWicketDelivery === 1 ? 1 : 0),
        extraRuns: over.extraRuns + data.extras_run
      });
    }
  } else {
    overs.set(data.overs, {
      runsScored: data.total_run,
      isMaidenOver: false,
      wicketsPoint:
        data.isWicketDelivery === 1 &&
        (data.kind !== "lbw" || data.kind !== "runout")
          ? 25
          : 0,
      lbwBowledBouns: data.kind === "caugh" || data.kind === "lbw" ? 8 : 0,
      wickets: data.isWicketDelivery === 1 ? 1 : 0,
      extraRuns: data.extras_run
    });
    bollwingDataMap.set(data.bowler, { overs });
  }
}

module.exports = {
  addTeam,
  processResult,
  getTeamResult,
};
