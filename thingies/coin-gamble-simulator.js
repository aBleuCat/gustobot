
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

async function askInteger(prompt, min = 0) {
  while (true) {
    const answer = await rl.question(prompt);
    const value = Number(answer.trim());

    if (
      answer.trim() !== "" &&
      Number.isSafeInteger(value) &&
      value >= min
    ) {
      return value;
    }

    console.log(`Enter a whole number of at least ${min}.`);
  }
}

// Matches the original command: payout is 0, 1, or 2 coins.
function rollCoinPayout() {
  return Math.floor(Math.random() * 3);
}

// One bulk run performs one individual gamble per coin requested.
function simulate(startingCoins, runsRequested, coinsPerRun) {
  let balance = startingCoins;

  let highest = balance;
  let lowest = balance;
  let highestRun = 0;
  let lowestRun = 0;

  let totalWins = 0;
  let totalLosses = 0;
  let totalBreakEvens = 0;
  let totalGambles = 0;
  let totalSpent = 0;
  let totalPayout = 0;

  let biggestGain = 0;
  let biggestLoss = 0;
  let peak = balance;
  let maxDrawdown = 0;
  let balanceSum = balance;
  let runsCompleted = 0;

  for (let run = 1; run <= runsRequested; run++) {
    // The original bulk command processes the requested number
    // of individual gambles and applies their combined net result.
    let netChange = 0;

    for (let i = 0; i < coinsPerRun; i++) {
      const payout = rollCoinPayout();

      // Each gamble costs 1 coin, then adds its payout.
      netChange += payout - 1;

      totalGambles++;
      totalSpent++;
      totalPayout += payout;

      if (payout === 2) totalWins++;
      else if (payout === 1) totalBreakEvens++;
      else totalLosses++;
    }

    balance += netChange;
    runsCompleted++;

    biggestGain = Math.max(biggestGain, netChange);
    biggestLoss = Math.max(biggestLoss, -netChange);

    if (balance > highest) {
      highest = balance;
      highestRun = run;
    }

    if (balance < lowest) {
      lowest = balance;
      lowestRun = run;
    }

    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
    balanceSum += balance;
  }

  const profit = balance - startingCoins;

  return {
    startingCoins,
    runsRequested,
    runsCompleted,
    coinsPerRun,
    endingCoins: balance,
    profit,
    percentChange:
      startingCoins === 0 ? null : (profit / startingCoins) * 100,
    highest,
    highestRun,
    lowest,
    lowestRun,
    averageBalance: balanceSum / (runsCompleted + 1),
    maxDrawdown,
    averageNetPerRun:
      runsCompleted === 0 ? 0 : profit / runsCompleted,
    totalWins,
    totalLosses,
    totalBreakEvens,
    totalGambles,
    totalSpent,
    totalPayout,
    biggestGain,
    biggestLoss,
  };
}

function printResults(s) {
  const signed = n => (n >= 0 ? "+" : "") + n;

  console.log("\n========== RESULTS ==========");
  console.log(`Starting coins:       ${s.startingCoins}`);
  console.log(`Runs requested:       ${s.runsRequested}`);
  console.log(`Runs completed:       ${s.runsCompleted}`);
  console.log(`Gambles per run:      ${s.coinsPerRun}`);
  console.log("-----------------------------");
  console.log(`Ending coins:         ${s.endingCoins}`);
  console.log(`Net profit/loss:      ${signed(s.profit)}`);
  console.log(
    `Percent change:       ${
      s.percentChange === null
        ? "N/A (started with 0 coins)"
        : signed(Number(s.percentChange.toFixed(2))) + "%"
    }`
  );
  console.log("-----------------------------");
  console.log(`Highest balance:      ${s.highest} (after run ${s.highestRun})`);
  console.log(`Lowest balance:       ${s.lowest} (after run ${s.lowestRun})`);
  console.log(`Average balance:      ${s.averageBalance.toFixed(2)}`);
  console.log(`Maximum drawdown:     ${s.maxDrawdown}`);
  console.log(`Average net per run:  ${signed(Number(s.averageNetPerRun.toFixed(3)))}`);
  console.log("-----------------------------");
  console.log(`Individual wins:      ${s.totalWins}`);
  console.log(`Break-evens:          ${s.totalBreakEvens}`);
  console.log(`Individual losses:    ${s.totalLosses}`);
  console.log(`Total gambles:        ${s.totalGambles}`);
  console.log(`Coins spent:          ${s.totalSpent}`);
  console.log(`Coins paid out:       ${s.totalPayout}`);
  console.log(`Biggest run gain:     ${signed(s.biggestGain)}`);
  console.log(`Biggest run loss:     ${signed(-s.biggestLoss)}`);
  console.log("=============================\n");
}

async function main() {
  try {
    console.log("Horse Coin Bulk-Gamble Simulator");
    console.log("Each individual gamble costs 1 coin.");
    console.log("Payout is 0, 1, or 2 coins, equally likely.");
    console.log("A 10-coin bulk run means 10 separate gambles.\n");

    const startingCoins = await askInteger("Starting coins: ");
    const runs = await askInteger("Number of bulk runs: ", 1);
    const coinsPerRun = await askInteger(
      "Coins to bulk-gamble per run: ",
      1
    );

    const results = simulate(startingCoins, runs, coinsPerRun);
    printResults(results);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
