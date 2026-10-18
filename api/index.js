export default function handler(req, res) {
    const path = req.url.split("?")[0];

    console.log("METHOD:", req.method);
    console.log("PATH:", path);
    console.log("BODY:", req.body);

    // GET /360/version
    if (path === "/360/version" && req.method === "GET") {
        return res.status(200).json({
            version: "1.1.8",
            url: "https://www.mediafire.com/file/rqr0wr8uc4zq0op/360-tool-v1.2.1_fixed.zip/file"
        });
    }

    // /360/credit1234567 - SPD, MTK, META_FIX_BLACKSCREEN
    // ============================================
    const COSTS = {
        spd_unlock_bl: 1,
        transsion_unlock_bl: 3,
        mtk: 3,
        spd: 1,
        mtk_permanent: 5,
        zte_unlock_bl: 5,
    };

    function deepFind(obj, keys) {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const k of keys) {
            if (obj[k] !== undefined) return obj[k];
        }
        for (const v of Object.values(obj)) {
            if (v && typeof v === 'object') {
                const r = deepFind(v, keys);
                if (r !== undefined) return r;
            }
        }
        return undefined;
    }

    if (path === "/360/credit1234567" && (req.method === "GET" || req.method === "POST")) {
        const query = req.query || {};
        const body = req.body || {};

        const operation = deepFind(body, ['operation'])
            || query.operation
            || 'spd';

        const request_id = deepFind(body, ['request_id', 'requestId', 'requestid'])
            || query.request_id
            || query.requestId
            || generateUUID();

        const cost = COSTS[operation] ?? 3;

        const now = new Date();
        const server_time = now.toISOString().replace("T", " ").substring(0, 19);

        // Build response object FIRST
        const response = {
            success: true,
            message: "OK",
            operation: operation,
            request_id: request_id,
            cost: cost,
            credits_used: cost,
            credits_left: 248,
            balance: 248,
            confirmed_balance: 248,
            new_balance: 248,
            credits: 248,
            license_expiry: "2099-01-01 00:00:00",
            lock_expiry: "2099-01-01 00:00:00",
            server_time_utc: now.toISOString(),
            server_time: server_time,
            auth_check_interval: 3600,
            server_time_offset: 0,
            login_time: server_time
        };

        // ============================================
        // OPERATION ROUTING: SPD, MTK, META
        // ============================================
        if (operation === "spd") {
            response.message = "SPD operation successful";
            response.operation = "spd";
        } else if (operation === "mtk") {
            response.message = "MTK operation successful";
            response.operation = "mtk";
        } else if (operation === "meta_fix_blackscreen") {
            response.message = "Meta fix blackscreen operation successful";
            response.operation = "meta_fix_blackscreen";
            response.meta_status = "fixed";
            response.blackscreen_fix = "applied";
        } else {
            response.message = "Operation successful";
            response.operation = operation;
        }

        return res.status(200).json(response);
    }

    // POST /360/login12
    if (path === "/360/login12" && req.method === "POST") {
        const now = new Date();
        const time = now.toISOString()
            .replace("T", " ")
            .substring(0, 19);

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            server_time_utc: now.toISOString(),
            server_time: time,
            server_time_offset: 0,
            auth_check_interval: 3600,
            lock_expiry: "2099-01-01 00:00:00",
            login_time: time,
            license_expiry: "2099-01-01 00:00:00",
            credits: 250
        });
    }

    // ---- YOUR EXISTING CODE BELOW ----

    let action = "";

    try {
        if (req.body && req.body.action) {
            action = req.body.action;
        }
    } catch (e) {}

    if (action === "get_patch_algorithms" || req.url.includes("algorithms")) {
        return res.status(200).json({
            status: "SUCCESS",
            algorithms: []
        });
    }

    if (action === "get_secure_logic" || req.url.includes("secure")) {
        return res.status(200).json({
            status: "SUCCESS",
            data: "License valid"
        });
    }

    if (req.url.includes("check_update")) {
        return res.status(200).send("0.7.93");
    }

    // OLD FALLBACK
    return res.status(200).send("SUCCESS|732|2028-06-08");
}

// ============================================
// HELPER FUNCTION
// ============================================
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
