const express = require('express');
const { MatrixClient } = require("matrix-bot-sdk");

const app = express();
app.use(express.json());

// CONFIGURATION
let homeserverUrl = (process.env.HOMESERVER_URL || "").trim().replace(/\/$/, "");
const accessToken = process.env.ADMIN_ACCESS_TOKEN;
const widgetUrl = process.env.WIDGET_URL;
const widgetIcon = process.env.WIDGET_ICON;
const botUserId = process.env.BOT_USER_ID;

const client = new MatrixClient(homeserverUrl, accessToken);

app.post('/api/provision', async (req, res) => {
    const { userId, serviceType } = req.body;

    if (!userId || serviceType !== 'email') {
        return res.status(400).json({ error: "Invalid user or service type" });
    }

    try {
        const adminId = await client.getUserId();
        const widgetId = "postmoogle_dashboard";

        console.log(`[1/4] Creating Service Room for ${userId}...`);

        // 1. Create Room (User is Admin/100 immediately)
        const roomId = await client.createRoom({
            name: "Email Service Room",
            topic: "Official Email Service Room",
            invite: [userId === adminId ? "" : userId, botUserId].filter(i => i !== ""),
            preset: "private_chat",
            power_level_content_override: {
                users: {
                    [userId]: 100,
                    [adminId]: 100
                }
            }
        });

        // 2. Define Widget (Added 'id' and 'creatorUserId' for better Element compatibility)
        const widgetContent = {
            id: widgetId,
            url: widgetUrl,
            name: "Email Dashboard",
            type: "m.custom",
            avatar_url: widgetIcon,
            creatorUserId: adminId,
            data: {}
        };

        console.log(`[2/4] Sending m.widget state event...`);
        await client.sendStateEvent(roomId, "m.widget", widgetId, widgetContent);

        // 3. Define Layout (Pins sidebar to the right)
        const layoutContent = {
            widgets: {
                [widgetId]: {
                    container: "right",
                    width: 30,
                    index: 0
                }
            }
        };

        console.log("[3/4] Sending io.element.widgets.layout...");
        await client.sendStateEvent(roomId, "io.element.widgets.layout", "", layoutContent);

        // 4. Set Room Avatar (Makes the sidebar look professional)
        console.log("[4/4] Setting room branding...");
        await client.sendStateEvent(roomId, "m.room.avatar", "", { url: widgetIcon });

        console.log(`SUCCESS: Room ${roomId} provisioned.`);
        res.json({ success: true, roomId: roomId });

    } catch (err) {
        console.error("PROVISIONING FAILED:", err.body || err);
        res.status(500).json({
            error: "Failed to provision room",
            details: err.body ? err.body.error : err.message
        });
    }
});

const PORT = process.env.PROVISIONING_SERVICE_PORT || 3000;
app.listen(PORT, () => console.log(`Provisioning Service active on port ${PORT}`));