// api/index.js - Universal handler for all Knox Wizard requests
export default function handler(req, res) {
    // Log what the app is requesting (for debugging)
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Body:', req.body);
    
    // Parse the request body to see what action is being requested
    let action = '';
    try {
        if (req.body && req.body.action) {
            action = req.body.action;
        }
    } catch(e) {}
    
    // Handle different request types
    // All return SUCCESS to bypass everything
    
    // For algorithm fetching
    if (action === 'get_patch_algorithms' || req.url.includes('algorithms')) {
        return res.status(200).json({
            status: "SUCCESS",
            algorithms: []  // Empty array - no algorithms to fetch
        });
    }
    
    // For license validation (main request)
    if (action === 'get_secure_logic' || req.url.includes('secure')) {
        return res.status(200).json({
            status: "SUCCESS",
            data: "License valid"
        });
    }
    
    // For update check
    if (req.url.includes('check_update')) {
        return res.status(200).send("0.7.93"); // Same version - no update
    }
    
    // Default response for everything else
    return res.status(200).send('SUCCESS|732|2028-06-08');
}
