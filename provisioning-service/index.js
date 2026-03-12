const express = require('express');
const { MatrixClient } = require("matrix-bot-sdk");

const app = express();
app.use(express.json());

// CONFIGURATION (Use Railway Variables)
// Ensure no trailing slashes on homeserver URL
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

        console.log(`[1/5] Creating Service Room for ${userId}...`);

        const roomId = await client.createRoom({
            name: "Email Service Room",
            topic: "Official Email Service Room",
            invite: [userId === adminId ? "" : userId, botUserId].filter(i => i !== ""),
            preset: "private_chat",
            power_level_content_override: {
                users: {
                    [userId]: 100, // Full power to ensure layout works
                    [adminId]: 100
                }
            }
        });

        // 2. Define Widget Content
        const widgetContent = {
            id: widgetId,
            url: widgetUrl,
            name: "Email Dashboard",
            type: "m.custom",
            avatar_url: widgetIcon,
            creatorUserId: adminId,
            data: {}
        };

        console.log(`[2/5] Sending m.widget: ${widgetId}`);
        await client.sendStateEvent(roomId, "m.widget", widgetId, widgetContent);

        // 3. Define Layout (Sidebar)
        const layoutContent = {
            widgets: {
                [widgetId]: {
                    container: "right",
                    width: 30,
                    index: 0
                }
            }
        };

        console.log("[3/5] Sending layout instruction...");
        await client.sendStateEvent(roomId, "io.element.widgets.layout", "", layoutContent);

        // 4. Set Room Avatar
        await client.sendStateEvent(roomId, "m.room.avatar", "", { url: widgetIcon });

        // --- STEP 5: THE AUTO-TRUST MAGIC ---
        // This tells the user's Element client to "Trust" the widget automatically
        // so it opens WITHOUT the "Allow" button.
        console.log(`[5/5] Forcing Auto-Trust for ${userId}...`);
        await client.setRoomAccountData(userId, roomId, "m.widgets", {
            [widgetId]: {
                "content": widgetContent,
                "id": widgetId,
                "name": "Email Dashboard",
                "type": "m.custom",
                "url": widgetUrl
            }
        });

        console.log(`SUCCESS: Room ${roomId} is fully automated.`);
        res.json({ success: true, roomId: roomId });

    } catch (err) {
        console.error("PROVISIONING FAILED:", err.body || err);
        res.status(500).json({ error: "Failed to provision room", details: err.message });
    }
});

// Use Railway's standard PORT variable if possible
const PORT = process.env.PROVISIONING_SERVICE_PORT || 3000;
app.listen(PORT, () => console.log(`Provisioning Service active on port ${PORT}`));