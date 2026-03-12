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
        // Step 1: Room Creation
        console.log(`[1/4] Creating room for ${userId}...`);
        const roomId = await client.createRoom({
            name: "Company Email",
            topic: "Your official email service room",
            invite: [userId, botUserId],
            preset: "private_chat",
        });
        console.log(`Success: Room ID is ${roomId}`);

        // Step 2: Power Level
        console.log(`[2/4] Setting power level for user...`);
        await client.setUserPowerLevel(userId, roomId, 50);

        // Step 3: Widget
        console.log(`[3/4] Adding widget...`);
        const widgetId = "email_dashboard";
        const widgetContent = {
            url: widgetUrl,
            name: "Email Dashboard",
            type: "m.custom",
            avatar_url: widgetIcon,
            data: {}
        };
        await client.sendStateEvent(roomId, "m.widget", widgetId, widgetContent);

        // Step 4: Layout
        console.log(`[4/4] Pinning sidebar...`);
        const layoutContent = {
            widgets: {
                [widgetId]: { container: "right", width: 30, index: 0 }
            }
        };
        await client.sendStateEvent(roomId, "io.element.widgets.layout", "", layoutContent);

        console.log("Provisioning Complete!");
        res.json({ success: true, roomId: roomId });

    } catch (err) {
        // This prints the REAL error to Railway logs
        console.error("CRITICAL ERROR DURING PROVISIONING:");
        console.error(err.body || err);
        res.status(500).json({
            error: "Failed to provision room",
            details: err.body ? err.body.error : err.message
        });
    }
});

const PORT = process.env.PROVISIONING_SERVICE_PORT || 3000;
app.listen(PORT, () => console.log(`Provisioning Service on port ${PORT}`));