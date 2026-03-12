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
        console.log(`Creating Service Room for ${userId}...`);

        // 1. Create the room
        const roomId = await client.createRoom({
            name: "Company Email",
            topic: "Your official email service room",
            invite: [userId, botUserId],
            preset: "private_chat",
        });

        // 2. Give the user power to see the widget (Moderator level)
        await client.setUserPowerLevel(userId, roomId, 50);

        // 3. Define the Widget (m.widget)
        const widgetId = "email_dashboard";
        const widgetContent = {
            url: widgetUrl,
            name: "Email Dashboard",
            type: "m.custom",
            avatar_url: widgetIcon,
            data: {}
        };
        await client.sendStateEvent(roomId, "m.widget", widgetId, widgetContent);

        // 4. Pin to Sidebar (io.element.widgets.layout)
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

        res.json({ success: true, roomId: roomId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to provision room" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Provisioning Service on port ${PORT}`));