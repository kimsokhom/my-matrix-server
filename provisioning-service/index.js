import express from "express";

const app = express();
app.use(express.json());

// ================= CONFIGURATION =================
const homeserverUrl = (process.env.HOMESERVER_URL || "").trim().replace(/\/$/, "");
const accessToken = process.env.ADMIN_ACCESS_TOKEN;
const widgetUrl = process.env.WIDGET_URL;
const widgetIcon = process.env.WIDGET_ICON;
const botUserId = process.env.BOT_USER_ID;
const PORT = process.env.PROVISIONING_SERVICE_PORT || 3000;

if (!homeserverUrl || !accessToken) {
    console.error("Missing required environment variables: HOMESERVER_URL or ADMIN_ACCESS_TOKEN");
    process.exit(1);
}

// ================= MATRIX CLIENT =================
async function matrixRequest(method, path, body) {
    const url = `${homeserverUrl}/_matrix/client/v3${path}`;
    const res = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
        const err = new Error(data.error || `Matrix API error: ${res.status}`);
        err.status = res.status;
        err.body = data;
        throw err;
    }
    return data;
}

// ================= ROUTES =================
app.post("/api/provision", async (req, res) => {
    const { userId, serviceType } = req.body;

    if (!userId || serviceType !== "email") {
        return res.status(400).json({
            error: "Invalid request: userId required and serviceType must be 'email'",
        });
    }

    try {
        const { user_id: adminId } = await matrixRequest("GET", "/account/whoami");
        const widgetId = "postmoogle_dashboard";

        console.log("➡️  [Provision] Start provisioning for:", userId);

        // 1. Create room
        const { room_id: roomId } = await matrixRequest("POST", "/createRoom", {
            name: "Email Service Room",
            topic: "Official Email Service Room",
            invite: botUserId ? [botUserId] : [],
            preset: "private_chat",
            power_level_content_override: {
                users: {
                    [userId]: 100,
                    [adminId]: 100,
                },
            },
        });
        console.log("✅ Room created:", roomId);

        const encodedRoomId = encodeURIComponent(roomId);

        // 2. Add widget
        if (widgetUrl) {
            await matrixRequest("PUT", `/rooms/${encodedRoomId}/state/m.widget/${widgetId}`, {
                id: widgetId,
                url: widgetUrl,
                name: "Email Dashboard",
                type: "m.custom",
                avatar_url: widgetIcon,
                creatorUserId: adminId,
                data: {},
            });
            console.log("✅ Widget added");
        }

        // 3. Layout
        await matrixRequest("PUT", `/rooms/${encodedRoomId}/state/io.element.widgets.layout/`, {
            widgets: {
                [widgetId]: { container: "right", width: 30, index: 0 },
            },
        });
        console.log("✅ Layout configured");

        // 4. Room avatar
        if (widgetIcon) {
            await matrixRequest("PUT", `/rooms/${encodedRoomId}/state/m.room.avatar/`, { url: widgetIcon });
            console.log("✅ Room avatar set");
        }

        // 5. Invite user
        if (userId !== adminId) {
            await matrixRequest("POST", `/rooms/${encodedRoomId}/invite`, { user_id: userId });
            console.log("✅ User invited:", userId);
        }

        console.log("🎉 Provisioning complete:", roomId);
        return res.json({ success: true, roomId });

    } catch (err) {
        console.error("❌ Provisioning failed:", err?.body || err);
        return res.status(500).json({
            error: "Failed to provision room",
            details: err?.body?.error || err.message,
        });
    }
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(`Provisioning service running on port ${PORT}`);
});
