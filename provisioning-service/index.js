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
        console.log(`[1/4] Preparing room for ${userId}...`);

        // 1. Get the Admin's own ID so we don't invite ourselves
        const adminId = await client.getUserId();

        // 2. Build the invite list (only invite people who aren't the admin)
        const inviteList = [];
        if (userId !== adminId) inviteList.push(userId);
        if (botUserId !== adminId) inviteList.push(botUserId);

        const roomId = await client.createRoom({
            name: "Company Email",
            topic: "Your official email service room",
            invite: inviteList, // Use the smart list
            preset: "private_chat",
        });
        console.log(`Success: Room ID is ${roomId}`);

        // 3. Power Level (Only needed if the user isn't the Admin)
        if (userId !== adminId) {
            console.log(`[2/4] Setting power level for user...`);
            await client.setUserPowerLevel(userId, roomId, 50);
        } else {
            console.log(`[2/4] User is Admin, skipping power level...`);
        }

        // 4. Widget
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

        // 5. Layout (Auto-sidebar)
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