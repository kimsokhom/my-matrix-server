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

        console.log(`[1/5] Creating Service Room (Without User)...`);

        // 1. Create Room ONLY with the Bot first. 
        // We pre-assign power level 100 to the user so they have rights when they join.
        const roomId = await client.createRoom({
            name: "Email Service Room",
            topic: "Official Email Service Room",
            invite: [botUserId].filter(i => i !== ""),
            preset: "private_chat",
            power_level_content_override: {
                users: {
                    [userId]: 100,
                    [adminId]: 100
                }
            }
        });

        // 2. Define Widget 
        const widgetContent = {
            id: widgetId,
            url: widgetUrl,
            name: "Email Dashboard",
            type: "m.custom",
            avatar_url: widgetIcon,
            creatorUserId: adminId,
            data: {}
        };

        console.log(`[2/5] Sending m.widget state event...`);
        await client.sendStateEvent(roomId, "m.widget", widgetId, widgetContent);

        // 3. Define Layout 
        const layoutContent = {
            widgets: {
                [widgetId]: {
                    container: "right",
                    width: 30,
                    index: 0
                }
            }
        };

        console.log("[3/5] Sending io.element.widgets.layout...");
        await client.sendStateEvent(roomId, "io.element.widgets.layout", "", layoutContent);

        // 4. Set Room Avatar
        console.log("[4/5] Setting room branding...");
        await client.sendStateEvent(roomId, "m.room.avatar", "", { url: widgetIcon });

        // 5. FINALLY, Invite the user!
        // Now when they join, the room state is already fully built.
        console.log(`[5/5] Inviting user ${userId}...`);
        if (userId !== adminId) {
            await client.inviteUser(userId, roomId);
        }

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