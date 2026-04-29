const FIGMA_API = "https://api.figma.com";

const headers = {
    "X-Figma-Token": process.env.FIGMA_ACCESS_TOKEN,
    "Content-Type": "application/json"
};

async function main() {
    console.log("Starting Figma webhook rotation...");

    // 1. List all existing webhooks for the team
    const listRes = await fetch(
        `${FIGMA_API}/v2/webhooks?context=team&context_id=${process.env.FIGMA_TEAM_ID}`,
        { headers }
    );
    const list = await listRes.json();
    console.log("Current webhooks:", JSON.stringify(list.webhooks?.map(w => ({
        id: w.id,
        status: w.status,
        endpoint: w.endpoint
    }))));

    // 2. Delete any webhook pointing at our Hookshot URL
    for (const wh of list.webhooks ?? []) {
        if (wh.endpoint === process.env.HOOKSHOT_WEBHOOK_URL) {
            const del = await fetch(`${FIGMA_API}/v2/webhooks/${wh.id}`, {
                method: "DELETE",
                headers
            });
            console.log(`Deleted webhook ${wh.id} — status ${del.status}`);
        }
    }

    // 3. Recreate fresh webhook
    const createRes = await fetch(`${FIGMA_API}/v2/webhooks`, {
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
    const created = await createRes.json();
    console.log("Created new webhook:", created.id, "status:", created.status);

    // 4. Ping Healthchecks.io so we know the cron ran successfully
    if (process.env.HC_PING_URL) {
        await fetch(process.env.HC_PING_URL);
        console.log("Pinged healthcheck.");
    }

    console.log("Rotation complete.");
}

main().catch(e => {
    console.error("Rotation failed:", e);
    process.exit(1);
});