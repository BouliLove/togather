require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// Function to geocode an address and return latitude and longitude
const geocodeAddress = async (address) => {
    try {
        const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
            params: {
                address: address,
                key: GOOGLE_MAPS_API_KEY,
            },
        });

        const location = response.data.results[0]?.geometry?.location;
        return location ? { lat: location.lat, lng: location.lng } : null;
    } catch (error) {
        console.error("Error geocoding address:", error);
        return null;
    }
};

// Function to compute the epicenter (geographic center) of multiple addresses
const computeEpicenter = async (addresses) => {
    const geocodedLocations = [];
    
    // Geocode all addresses
    for (let address of addresses) {
        const location = await geocodeAddress(address);
        if (location) {
            geocodedLocations.push(location);
        }
    }

    if (geocodedLocations.length === 0) {
        return null; // No valid locations found
    }

    // Calculate the average latitude and longitude to get the center point
    const latSum = geocodedLocations.reduce((sum, loc) => sum + loc.lat, 0);
    const lngSum = geocodedLocations.reduce((sum, loc) => sum + loc.lng, 0);

    const averageLat = latSum / geocodedLocations.length;
    const averageLng = lngSum / geocodedLocations.length;

    return { lat: averageLat, lng: averageLng };
};


const app = express();
app.use(express.json());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin.startsWith("http://localhost:")) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

const PORT = 5001;  // Ensure this matches your backend port
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Function to fetch travel times
const getTravelTimes = async (origins, destinations, mode) => {
    try {
        const response = await axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json`, {
            params: {
                origins: origins.join("|"),
                destinations: destinations.join("|"),
                mode: mode,
                key: GOOGLE_MAPS_API_KEY
            }
        });

        console.log("Google Maps API Response:", JSON.stringify(response.data, null, 2));

        return response.data.rows.map(row => row.elements.map(el => el.duration?.value || Infinity));
    } catch (error) {
        console.error("Error fetching travel times:", error.response?.data || error.message);
        return [];
    }
};


// Endpoint to compute the best meeting location
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

app.post("/compute-location", async (req, res) => {
    const { locations } = req.body;

    if (locations.length < 2) {
        return res.status(400).json({ error: "At least two locations are required." });
    }

    // Extract addresses
    const addresses = locations.map((loc) => loc.address);

    // Compute the epicenter (geographic center) of all addresses
    const epicenter = await computeEpicenter(addresses);

    if (!epicenter) {
        return res.status(500).json({ error: "Unable to compute epicenter." });
    }

    console.log("Calculated Epicenter:", epicenter);

    // Return the computed meeting point
    res.json({ bestLocation: epicenter });
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
