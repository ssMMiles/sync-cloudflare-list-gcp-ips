/**
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

export interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_LIST_ID: string;

  GCP_SCOPE: string;
}

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const CF_API_REPLACE_LIST_ITEMS = (accountId: string, listId: string) =>
  `${CF_API_BASE}/accounts/${accountId}/rules/lists/${listId}/items`;

const IP_RANGES_URI = "https://www.gstatic.com/ipranges/cloud.json";

interface IP_RANGES {
  syncToken: string;
  creationTime: string;
  prefixes: {
    ipv4Prefix?: string;
    ipv6Prefix?: string;
    service: string;
    scope: string;
  }[];
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    return updateIpRanges(env);
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      await updateIpRanges(env);
      return new Response("OK", { status: 200 });
    } catch (e: any) {
      return new Response(e.message, { status: 500 });
    }
  },
};

async function updateIpRanges(env: Env): Promise<void> {
  const data = await fetch(IP_RANGES_URI).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to fetch ${IP_RANGES_URI}`);
    }

    return res.json();
  });

  const { prefixes } = data as IP_RANGES;
  if (!Array.isArray(prefixes)) {
    throw new Error(`Fetched invalid IP range data: \n${JSON.stringify(data)}`);
  }

  const scopes =
    env.GCP_SCOPE.trim() === "*"
      ? true
      : env.GCP_SCOPE.split(",").map((s) => s.trim());
  const ipRanges = prefixes.reduce((ipRanges, prefix) => {
    if (scopes === true || scopes.includes(prefix.scope)) {
      let ip;

      if ("ipv4Prefix" in prefix) {
        ip = prefix.ipv4Prefix;
      }

      if ("ipv6Prefix" in prefix) {
        ip = prefix.ipv6Prefix;
      }

      if (ip) {
        ipRanges.push({
          ip,
          comment:
            "Added by https://github.com/ssMMiles/sync-cloudflare-list-gcp-ips",
        });
      }
    }

    return ipRanges;
  }, [] as { ip: string; comment: string }[]);

  const result = await fetch(
    CF_API_REPLACE_LIST_ITEMS(env.CF_ACCOUNT_ID, env.CF_LIST_ID),
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
      },
      body: JSON.stringify(ipRanges),
    }
  );

  if (!result.ok) {
    throw new Error(`Failed to replace IP ranges - ${await result.json()}`);
  }

  return;
}
