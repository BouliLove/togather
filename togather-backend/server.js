require("dotenv").config({ path: "./.env" });
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
console.log("Loaded Google Maps API Key:", GOOGLE_MAPS_API_KEY);

const express = require("express");
const cors = require("cors");
const axios = require("axios");

// Geocode an address and return its latitude/longitude.
const geocodeAddress = async (address) => {
  try {
    console.log("Geocoding address:", address);
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: address,
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );
    console.log("Geocode response for address:", address, response.data);
    const location = response.data.results[0]?.geometry?.location;
    return location ? { lat: location.lat, lng: location.lng } : null;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
};

// Compute the geographic epicenter (average) of an array of addresses.
const computeEpicenter = async (addresses) => {
  const geocodedLocations = [];
  for (const address of addresses) {
    const location = await geocodeAddress(address);
    if (location) {
      geocodedLocations.push(location);
    }
  }
  if (geocodedLocations.length === 0) return null;
  const latSum = geocodedLocations.reduce((sum, loc) => sum + loc.lat, 0);
  const lngSum = geocodedLocations.reduce((sum, loc) => sum + loc.lng, 0);
  return { lat: latSum / geocodedLocations.length, lng: lngSum / geocodedLocations.length };
};

// For one origin to a given destination using a specified transport mode.
const getTravelTimeForOrigin = async (origin, destination, mode) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: origin,
          destinations: destination,
          mode: mode,
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );
    const duration = response.data.rows[0].elements[0].duration?.value;
    return duration || Infinity;
  } catch (error) {
    console.error("Error fetching travel time for", origin, destination, mode, error);
    return Infinity;
  }
};

// Lookup a nearby venue (restaurant, café, or bar) near a given location.
const lookupVenue = async (location) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${location.lat},${location.lng}`,
          radius: 1500, // in meters
          keyword: "restaurant cafe bar",
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0]; // Return the first candidate
    }
    return null;
  } catch (error) {
    console.error("Error looking up venue:", error);
    return null;
  }
};

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith("http://localhost:")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

const PORT = 5001;

// Log incoming requests.
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Endpoint to compute the best meeting location.
app.post("/compute-location", async (req, res) => {
  const { locations } = req.body;
  console.log("Received locations:", locations);
  if (locations.length < 2) {
    return res.status(400).json({ error: "At least two locations are required." });
  }

  // Extract addresses.
  const addresses = locations.map((loc) => loc.address);
  console.log("Extracted addresses:", addresses);

  // Compute the initial epicenter.
  const epicenter = await computeEpicenter(addresses);
  if (!epicenter) {
    return res.status(500).json({ error: "Unable to compute epicenter." });
  }
  console.log("Calculated Epicenter:", epicenter);

  // --- Grid Search ---
  // Create a grid (3x3) around the epicenter.
  const delta = 0.005; // ~0.005 degrees (~500-600m in urban areas)
  const gridCandidates = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      gridCandidates.push({
        lat: epicenter.lat + i * delta,
        lng: epicenter.lng + j * delta,
      });
    }
  }

  // For each candidate, calculate travel times from each starting address.
  const candidateResults = await Promise.all(
    gridCandidates.map(async (candidate) => {
      const candidateStr = `${candidate.lat},${candidate.lng}`;
      const travelTimes = await Promise.all(
        locations.map(async (loc) => {
          const time = await getTravelTimeForOrigin(loc.address, candidateStr, loc.transport);
          return time;
        })
      );
      const validTimes = travelTimes.filter((t) => t !== Infinity);
      const averageTime =
        validTimes.length > 0
          ? validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length
          : Infinity;
      return { candidate, travelTimes, averageTime };
    })
  );

  // Sort candidates by average travel time.
  candidateResults.sort((a, b) => a.averageTime - b.averageTime);
  const bestCandidate = candidateResults[0];
  if (!bestCandidate) {
    return res.status(500).json({ error: "Unable to compute best meeting point." });
  }
  console.log(
    "Best grid candidate:",
    bestCandidate.candidate,
    "with average travel time (s):",
    bestCandidate.averageTime
  );

  // --- Venue Lookup ---
  // Search for a venue near the best candidate coordinates.
  const venue = await lookupVenue(bestCandidate.candidate);
  let finalVenue = null;
  if (venue) {
    finalVenue = venue;
    console.log("Found venue:", venue.name);
  } else {
    console.log("No venue found near candidate. Falling back to candidate coordinate.");
    finalVenue = {
      name: "Meeting Point",
      vicinity: "No venue found",
      geometry: { location: bestCandidate.candidate },
      place_id: null,
    };
  }

  // Recalculate travel times using the final venue's coordinates.
  const venueLocationStr = `${finalVenue.geometry.location.lat},${finalVenue.geometry.location.lng}`;
  const newTravelTimes = await Promise.all(
    locations.map(async (loc) => {
      const time = await getTravelTimeForOrigin(loc.address, venueLocationStr, loc.transport);
      return time;
    })
  );
  const validNewTimes = newTravelTimes.filter((t) => t !== Infinity);
  const newAverageTime =
    validNewTimes.length > 0 ? validNewTimes.reduce((sum, t) => sum + t, 0) / validNewTimes.length : Infinity;

  // Build the final result object.
  const result = {
    name: finalVenue.name,
    address: finalVenue.vicinity || finalVenue.formatted_address || "Address not available",
    location: finalVenue.geometry.location,
    travelTimes: newTravelTimes, // in seconds for each starting address
    averageTime: newAverageTime,  // in seconds
    placeId: finalVenue.place_id,
  };

  console.log("Final meeting point:", result);
  res.json({ bestLocation: result });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
