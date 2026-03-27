const express = require("express");
const { MatrixClient } = require("matrix-bot-sdk");

const app = express();
app.use(express.json());

// ================= CONFIGURATION =================
const homeserverUrl = (process.env.HOMESERVER_URL || "").trim().replace(/\/$/, "");
const accessToken = process.env.ADMIN_ACCESS_TOKEN;
const widgetUrl = process.env.WIDGET_URL;
const widgetIcon = process.env.WIDGET_ICON;
const botUserId = process.env.BOT_USER_ID;
const PORT = process.env.PROVISIONING_SERVICE_PORT || 3000;

// Validate required env vars at startup
if (!homeserverUrl || !accessToken) {
    console.error("Missing required environment variables: HOMESERVER_URL or ADMIN_ACCESS_TOKEN");
    process.exit(1);
}

const client = new MatrixClient(homeserverUrl, accessToken);

// ================= ROUTES =================
app.post("/api/provision", async (req, res) => {
    const { userId, serviceType } = req.body;

    // Input validation
    if (!userId || serviceType !== "email") {
        return res.status(400).json({
            error: "Invalid request: userId required and serviceType must be 'email'"
        });
    }

    try {
        const adminId = await client.getUserId();
        const widgetId = "postmoogle_dashboard";

        console.log("➡️  [Provision] Start provisioning for:", userId);

        // 1. Create room
        const roomId = await client.createRoom({
            name: "Email Service Room",
            topic: "Official Email Service Room",
            invite: botUserId ? [botUserId] : [],
            preset: "private_chat",
            power_level_content_override: {
                users: {
                    [userId]: 100,
                    [adminId]: 100
                }
            }
        });

        console.log("✅ Room created:", roomId);

        // 2. Add widget
        if (widgetUrl) {
            const widgetContent = {
                id: widgetId,
                url: widgetUrl,
                name: "Email Dashboard",
                type: "m.custom",
                avatar_url: widgetIcon,
                creatorUserId: adminId,
                data: {}
            };

            await client.sendStateEvent(roomId, "m.widget", widgetId, widgetContent);
            console.log("✅ Widget added");
        }

        // 3. Layout
        const layoutContent = {
            widgets: {
                [widgetId]: {
                    container: "right",
                    width: 30,
                    index: 0
                }
            }
        };

        await client.sendStateEvent(roomId, "io.element.widgets.layout", "", layoutContent);
        console.log("✅ Layout configured");

        // 4. Room avatar
        if (widgetIcon) {
            await client.sendStateEvent(roomId, "m.room.avatar", "", { url: widgetIcon });
            console.log("✅ Room avatar set");
        }

        // 5. Invite user
        if (userId !== adminId) {
            await client.inviteUser(userId, roomId);
            console.log("✅ User invited:", userId);
        }

        console.log("🎉 Provisioning complete:", roomId);

        return res.json({ success: true, roomId });

    } catch (err) {
        console.error("❌ Provisioning failed:", err?.body || err);

        return res.status(500).json({
            error: "Failed to provision room",
            details: err?.body?.error || err.message
        });
    }
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(`🚀 Provisioning service running on port ${PORT}`);
});