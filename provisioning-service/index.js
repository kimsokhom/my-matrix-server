const express = require('express');
const { MatrixClient, AutojoinRoomsMixin, SimpleFsStorageProvider } = require("matrix-bot-sdk");

const app = express();
app.use(express.json());

// CONFIGURATION (Use Railway Variables)
const homeserverUrl = process.env.HOMESERVER_URL;
const accessToken = process.env.ADMIN_ACCESS_TOKEN; // An admin user token
const widgetUrl = process.env.WIDGET_URL;
const widgetIcon = process.env.WIDGET_ICON;
const botUserId = process.env.BOT_USER_ID; // e.g., @postmoogle:yourdomain.com

const client = new MatrixClient(homeserverUrl, accessToken);

// THE "ORY-READY" ENDPOINT
app.post('/api/provision', async (req, res) => {
    const { userId, serviceType } = req.body;

    if (!userId || serviceType !== 'email') {
        return res.status(400).json({ error: "Invalid user or service type" });
    }

    try {
        const adminId = await client.getUserId();
        const widgetId = "postmoogle_dashboard"; // Consistent ID

        console.log(`[1/4] Creating Service Room for ${userId}...`);

        // Create room with custom power levels so user is a Moderator (50) immediately
        const roomId = await client.createRoom({
            name: "Company Email",
            topic: "Official Email Service Room",
            invite: [userId === adminId ? "" : userId, botUserId].filter(i => i !== ""),
            preset: "private_chat",
            power_level_content_override: {
                users: {
                    [userId]: 50, // Make user Moderator
                    [adminId]: 100 // Keep yourself Admin
                }
            }
        });

        // 2. Define the Widget (m.widget)
        // The STATE_KEY must be the widgetId
        console.log(`[2/4] Registering widget: ${widgetId}`);
        const widgetContent = {
            url: widgetUrl,
            name: "Postmoogle Dashboard",
            type: "m.custom",
            avatar_url: widgetIcon,
            data: {}
        };
        await client.sendStateEvent(roomId, "m.widget", widgetId, widgetContent);

        // 3. Pin to Sidebar (io.element.widgets.layout)
        // The key inside 'widgets' must match the widgetId above
        console.log(`[3/4] Sending layout instruction...`);
        const layoutContent = {
            widgets: {
                [widgetId]: {
                    container: "right",
                    width: 30,
                    index: 0
                }
            }
        };
        // State Key for layout must be empty string ""
        await client.sendStateEvent(roomId, "io.element.widgets.layout", "", layoutContent);

        // 4. Set Room Avatar (Optional: Make the room look pretty)
        console.log(`[4/4] Setting room branding...`);
        await client.sendStateEvent(roomId, "m.room.avatar", "", { url: widgetIcon });

        console.log("SUCCESS: Room provisioned with auto-sidebar.");
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
app.listen(PORT, () => console.log(`Provisioning Service on port ${PORT}`));