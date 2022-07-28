# sync-cloudflare-list-gcp-ips
Sync [GCP IP ranges](https://www.gstatic.com/ipranges/cloud.json) for a specified scope to a Cloudflare IP list.

Runs on a Cron Worker by default, but also has a fetch handler if you want to call it over HTTP.

# Environment

Set the following keys using `wrangler secret put <KEY>`:

 - `CF_ACCOUNT_ID`: Your Cloudflare account ID
 - `CF_API_TOKEN`: An API token with Edit permissions on `Account Filter Lists`.
 - `CF_LIST_ID`: The ID of the list in which the IPs will be stored.
 
 - `GCP_SCOPE`: One of the scopes in [GCP's IP ranges](https://www.gstatic.com/ipranges/cloud.json), e.g `us-east1`
