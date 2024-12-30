import { setTimeout } from "node:timers/promises";
import { LightningTime } from "@purduehackers/time";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { setIntervalAsync } from "set-interval-async";

import { env } from "./env";

const TIME_CHANNEL_ID = "1320962769285283900";
const DAY = 1000 * 60 * 60 * 24;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const lt = new LightningTime();

client.on(Events.ClientReady, async (event) => {
  console.log(`Logged in as ${event.user.tag}!`);

  const channel = await client.channels.fetch(TIME_CHANNEL_ID);

  if (!channel || !channel.isVoiceBased()) {
    throw new Error("Channel TIME_CHANNEL_ID is not a voice channel");
  }

  await updateChannel();

  setIntervalAsync(async () => await updateChannel(), 1000 * 60 * 5);
});

client.login(env.DISCORD_BOT_TOKEN);

async function updateChannel() {
  console.debug("Updating time...");
  await syncTime();
  const time = lt.convertToLightning(new Date());

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${TIME_CHANNEL_ID}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: `Time: ${time.lightningString}` }),
      },
    );

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const global = response.headers.get("X-RateLimit-Global");

      if (!retryAfter) {
        throw new Error("Rate limit headers missing");
      }

      if (global) {
        console.debug(`Global rate limit hit, waiting ${retryAfter} seconds`);
      } else {
        console.debug(`Rate limited, waiting ${retryAfter} seconds`);
      }

      const timeout = Number.parseFloat(retryAfter) * 1000 + 1000;

      await setTimeout(timeout);
      return;
    }

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    console.debug(`Updated time to ${time.lightningString}`);
  } catch (error) {
    console.error(error);
  }
}

async function syncTime() {
  console.log("Syncing time...");
  const now = lt.convertToLightning(new Date());
  const charges = Number.parseInt(now.parts.charges, 16);
  const millisecondsToSync = (DAY / 16 ** 4) * (16 - charges);
  await setTimeout(millisecondsToSync);
}
