// Figma Webhook Rotator
// Runs every 3 hours via Railway Cron
// Required env vars:
//   FIGMA_ACCESS_TOKEN, FIGMA_TEAM_ID, HOOKSHOT_WEBHOOK_URL,
//   FIGMA_WEBHOOK_PASSCODE, HC_PING_URL (optional)

const FIGMA_API = "https://api.figma.com";

const headers = {
    "X-Figma-Token": process.env.FIGMA_ACCESS_TOKEN,
    "Content-Type": "application/json"
};

// Timeout wrapper — prevents hanging forever if Figma API is slow
const fetchWithTimeout = (url, options, timeout = 10000) =>
    Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout: ${url}`)), timeout)
        )
    ]);

async function main() {
    console.log(JSON.stringify({ event: "rotation_started", timestamp: new Date().toISOString() }));

    // 1. List existing webhooks
    const listRes = await fetchWithTimeout(
        `${FIGMA_API}/v2/webhooks?context=team&context_id=${process.env.FIGMA_TEAM_ID}`,
        { headers }
    );
    if (!listRes.ok) {
        throw new Error(`Failed to list webhooks: ${listRes.status}`);
    }
    const list = await listRes.json();
    console.log(JSON.stringify({
        event: "webhooks_listed",
        count: list.webhooks?.length ?? 0,
        webhooks: list.webhooks?.map(w => ({ id: w.id, status: w.status, endpoint: w.endpoint }))
    }));

    // 2. Delete all webhooks pointing at our Hookshot URL
    for (const wh of list.webhooks ?? []) {
        if (wh.endpoint === process.env.HOOKSHOT_WEBHOOK_URL) {
            const delRes = await fetchWithTimeout(
                `${FIGMA_API}/v2/webhooks/${wh.id}`,
                { method: "DELETE", headers }
            );
            console.log(JSON.stringify({
                event: "webhook_deleted",
                id: wh.id,
                status: delRes.status
            }));
        }
    }

    // 3. Recreate fresh webhook
    const createRes = await fetchWithTimeout(`${FIGMA_API}/v2/webhooks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            event_type: "FILE_COMMENT",
            context: "team",
            context_id: process.env.FIGMA_TEAM_ID,
            endpoint: process.env.HOOKSHOT_WEBHOOK_URL,
            passcode: process.env.FIGMA_WEBHOOK_PASSCODE,
            description: "hookshot-auto-rotate"
        })
    });
    if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`Failed to create webhook: ${createRes.status} ${text}`);
    }
    const created = await createRes.json();
    console.log(JSON.stringify({
        event: "webhook_created",
        id: created.id,
        status: created.status,
        endpoint: created.endpoint
    }));

    // 4. Ping Healthchecks.io — confirms cron ran successfully
    if (process.env.HC_PING_URL) {
        await fetchWithTimeout(process.env.HC_PING_URL, {});
        console.log(JSON.stringify({ event: "healthcheck_pinged" }));
    }

    console.log(JSON.stringify({ event: "rotation_complete", timestamp: new Date().toISOString() }));
}

main().catch(e => {
    console.error(JSON.stringify({ event: "rotation_failed", error: e.message }));
    process.exit(1);
});